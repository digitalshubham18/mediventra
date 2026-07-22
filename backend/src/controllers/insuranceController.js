const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const { notify } = require('../utils/notify');
const { buildFileUrl } = require('../middleware/upload');

// ── Policies ─────────────────────────────────────────────────────────────

// GET /api/insurance/policies — the logged-in patient's own policies
exports.getMyPolicies = async (req, res) => {
  try {
    const policies = await InsurancePolicy.find({ patient: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: policies.map(p => ({ ...p.toObject(), isValid: p.isCurrentlyValid() })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/insurance/policies/:patientId — staff (admin/finance/receptionist/doctor)
// looking up a specific patient's policies, e.g. while raising a pre-authorization
exports.getPatientPolicies = async (req, res) => {
  try {
    const policies = await InsurancePolicy.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
    res.json({ success: true, data: policies.map(p => ({ ...p.toObject(), isValid: p.isCurrentlyValid() })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/insurance/policies
exports.addPolicy = async (req, res) => {
  try {
    const { provider, policyNumber, policyType, sumInsured, validFrom, validTill, notes } = req.body;
    const missing = ['provider','policyNumber','sumInsured','validFrom','validTill'].filter(k => !req.body[k]);
    if (missing.length) return res.status(400).json({ success: false, error: `Please fill in: ${missing.join(', ')}` });
    if (new Date(validTill) <= new Date(validFrom)) return res.status(400).json({ success: false, error: 'Valid-till date must be after valid-from date' });

    const cardImageUrl = req.file ? buildFileUrl(req.file, 'insurance') : '';
    const policy = await InsurancePolicy.create({
      patient: req.user.id, provider, policyNumber, policyType: policyType || 'individual',
      sumInsured: Number(sumInsured), validFrom, validTill, notes: notes || '', cardImageUrl,
    });
    res.status(201).json({ success: true, data: policy });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/insurance/policies/:id
exports.deletePolicy = async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, patient: req.user.id });
    if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });
    const activeClaim = await InsuranceClaim.findOne({ policy: policy._id, status: { $in: ['submitted','under_review'] } });
    if (activeClaim) return res.status(400).json({ success: false, error: 'Cannot delete a policy with a claim currently under review' });
    await policy.deleteOne();
    res.json({ success: true, message: 'Policy removed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Claims (patient side) ──────────────────────────────────────────────

// GET /api/insurance/claims/mine
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await InsuranceClaim.find({ patient: req.user.id }).populate('policy', 'provider policyNumber').populate('appointment', 'appointmentNumber date').sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/insurance/claims
exports.submitClaim = async (req, res) => {
  try {
    const { policyId, appointmentId, claimAmount, reason } = req.body;
    if (!policyId || !claimAmount || !reason) {
      return res.status(400).json({ success: false, error: 'Policy, claim amount, and reason are required' });
    }
    const policy = await InsurancePolicy.findOne({ _id: policyId, patient: req.user.id });
    if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });
    if (!policy.isCurrentlyValid()) {
      return res.status(400).json({ success: false, error: 'This policy is not currently valid (check its validity dates) — claims can\u2019t be submitted against an expired or not-yet-active policy.' });
    }
    if (Number(claimAmount) > policy.sumInsured) {
      return res.status(400).json({ success: false, error: `Claim amount exceeds this policy's sum insured (₹${policy.sumInsured.toLocaleString('en-IN')}).` });
    }

    const documents = (req.files || []).map(f => buildFileUrl(f, 'insurance'));
    if (documents.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one supporting document (bill, prescription, or report) is required to submit a claim' });
    }
    const claim = await InsuranceClaim.create({
      patient: req.user.id, policy: policyId, appointment: appointmentId || undefined,
      claimAmount: Number(claimAmount), reason, documents, status: 'submitted',
    });

    const io = req.app.get('io');
    if (io) io.emit('insurance_claim_submitted', { claimId: claim._id, patientName: req.user.name, amount: claim.claimAmount });

    res.status(201).json({ success: true, data: claim, message: 'Claim submitted — our billing team will review it shortly.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Claims (staff review side: admin / finance) ─────────────────────────

// GET /api/insurance/claims — all claims, optionally filtered by status
exports.getAllClaims = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const claims = await InsuranceClaim.find(q)
      .populate('patient', 'name email phone')
      .populate('policy', 'provider policyNumber sumInsured')
      .populate('appointment', 'appointmentNumber date')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/insurance/claims/:id/review — approve or reject
exports.reviewClaim = async (req, res) => {
  try {
    const { status, approvedAmount, reviewNotes } = req.body;
    if (!['approved','rejected','under_review'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status' });
    }
    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name email notificationPrefs');
    if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
    if (['approved','rejected','paid'].includes(claim.status)) {
      return res.status(400).json({ success: false, error: `This claim was already ${claim.status} and can\u2019t be reviewed again.` });
    }
    if (status === 'approved' && (approvedAmount === undefined || approvedAmount === null || approvedAmount === '')) {
      return res.status(400).json({ success: false, error: 'Please specify the approved amount' });
    }

    claim.status = status;
    claim.reviewNotes = reviewNotes || '';
    claim.reviewedBy = req.user.id;
    claim.reviewedAt = new Date();
    if (status === 'approved') claim.approvedAmount = Number(approvedAmount);
    await claim.save();

    const io = req.app.get('io');
    if (io) io.to(`user_${claim.patient._id}`).emit('insurance_claim_updated', { claimId: claim._id, status: claim.status, approvedAmount: claim.approvedAmount, reviewNotes: claim.reviewNotes });
    await notify(req, claim.patient._id, { type:'insurance_claim_updated', title: status==='approved' ? '✅ Insurance claim approved' : status==='rejected' ? '❌ Insurance claim rejected' : '🔍 Insurance claim under review', message: status==='approved' ? `Approved for ₹${Number(approvedAmount).toLocaleString('en-IN')}` : (reviewNotes || 'Check your Insurance page for details'), link:'/insurance', icon: status==='approved'?'✅':status==='rejected'?'❌':'🔍' });

    res.json({ success: true, data: claim });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/insurance/claims/:id/pay — mark an approved claim as paid out
exports.markClaimPaid = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name');
    if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
    if (claim.status !== 'approved') return res.status(400).json({ success: false, error: 'Only approved claims can be marked as paid' });
    claim.status = 'paid';
    claim.paidAt = new Date();
    await claim.save();

    const io = req.app.get('io');
    if (io) io.to(`user_${claim.patient._id}`).emit('insurance_claim_updated', { claimId: claim._id, status: 'paid' });
    await notify(req, claim.patient._id, { type:'insurance_claim_updated', title:'💸 Insurance claim paid out', message:`₹${claim.approvedAmount?.toLocaleString('en-IN')} has been paid out for your claim`, link:'/insurance', icon:'💸' });

    res.json({ success: true, data: claim });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
