const TPAProvider = require('../models/TPAProvider');
const PreAuthRequest = require('../models/PreAuthRequest');
const InsurancePolicy = require('../models/InsurancePolicy');
const User = require('../models/User');
const { notify } = require('../utils/notify');

// ── TPA PROVIDER & RATE MANAGEMENT ──────────────────────────────────────

// POST /api/tpa/providers
exports.createProvider = async (req, res) => {
  try {
    const { name, tpaCode, contactPerson, contactPhone, contactEmail, address } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'TPA/provider name is required' });
    const provider = await TPAProvider.create({
      name: name.trim(), tpaCode: tpaCode?.trim()||'', contactPerson: contactPerson?.trim()||'',
      contactPhone: contactPhone?.trim()||'', contactEmail: contactEmail?.trim()||'', address: address?.trim()||'',
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: provider });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/tpa/providers?all=1
exports.getProviders = async (req, res) => {
  try {
    const q = req.query.all ? {} : { active: true };
    const providers = await TPAProvider.find(q).sort({ name: 1 });
    res.json({ success: true, data: providers });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/tpa/providers/:id
exports.updateProvider = async (req, res) => {
  try {
    const allowed = ['name','tpaCode','contactPerson','contactPhone','contactEmail','address','active'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const provider = await TPAProvider.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    res.json({ success: true, data: provider });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/tpa/providers/:id/rates — add a negotiated rate
exports.addRate = async (req, res) => {
  try {
    const { procedureName, negotiatedRate, notes } = req.body;
    if (!procedureName?.trim() || negotiatedRate === undefined) return res.status(400).json({ success: false, error: 'Procedure name and negotiated rate are required' });
    const provider = await TPAProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    provider.rates.push({ procedureName: procedureName.trim(), negotiatedRate: Number(negotiatedRate), notes: notes?.trim()||'' });
    await provider.save();
    res.status(201).json({ success: true, data: provider });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/tpa/providers/:id/rates/:rateId
exports.updateRate = async (req, res) => {
  try {
    const provider = await TPAProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    const rate = provider.rates.id(req.params.rateId);
    if (!rate) return res.status(404).json({ success: false, error: 'Rate not found' });
    const { procedureName, negotiatedRate, notes } = req.body;
    if (procedureName !== undefined) rate.procedureName = procedureName.trim();
    if (negotiatedRate !== undefined) rate.negotiatedRate = Number(negotiatedRate);
    if (notes !== undefined) rate.notes = notes.trim();
    await provider.save();
    res.json({ success: true, data: provider });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// DELETE /api/tpa/providers/:id/rates/:rateId
exports.deleteRate = async (req, res) => {
  try {
    const provider = await TPAProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    provider.rates = provider.rates.filter(r => String(r._id) !== req.params.rateId);
    await provider.save();
    res.json({ success: true, data: provider });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── PRE-AUTHORIZATION ────────────────────────────────────────────────────

// POST /api/tpa/pre-auth — hospital staff submit a cashless pre-auth request
exports.createPreAuth = async (req, res) => {
  try {
    const { patientId, policyId, tpaProviderId, admissionId, appointmentId, diagnosis, treatmentPlan, estimatedAmount, documents } = req.body;
    if (!patientId || !policyId || !diagnosis?.trim() || estimatedAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Patient, policy, diagnosis, and estimated amount are required' });
    }
    const policy = await InsurancePolicy.findOne({ _id: policyId, patient: patientId });
    if (!policy) return res.status(404).json({ success: false, error: "Policy not found for this patient" });
    if (!policy.isCurrentlyValid()) {
      return res.status(400).json({ success: false, error: `This policy is not currently valid (validity: ${new Date(policy.validFrom).toLocaleDateString('en-IN')} to ${new Date(policy.validTill).toLocaleDateString('en-IN')})` });
    }

    const preAuth = await PreAuthRequest.create({
      patient: patientId, policy: policyId, tpaProvider: tpaProviderId || null,
      admission: admissionId || null, appointment: appointmentId || null,
      diagnosis: diagnosis.trim(), treatmentPlan: treatmentPlan?.trim()||'', estimatedAmount: Number(estimatedAmount),
      documents: documents || [], requestedBy: req.user.id,
    });
    await preAuth.populate('patient', 'name phone');
    await preAuth.populate('policy', 'provider policyNumber sumInsured');
    await preAuth.populate('tpaProvider', 'name');

    await notify(req, patientId, {
      type: 'preauth_submitted', title: '🛡️ Pre-authorization submitted',
      message: `${preAuth.preAuthNumber} — estimated ₹${Number(estimatedAmount).toLocaleString('en-IN')} sent to your insurer`,
      link: '/insurance', icon: '🛡️',
    });

    res.status(201).json({ success: true, data: preAuth });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/tpa/pre-auth?status=&patientId=
exports.getPreAuths = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.patient = req.user.id;
    else if (req.query.patientId) q.patient = req.query.patientId;
    if (req.query.status) q.status = req.query.status;
    const preAuths = await PreAuthRequest.find(q)
      .populate('patient', 'name phone')
      .populate('policy', 'provider policyNumber sumInsured')
      .populate('tpaProvider', 'name')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: preAuths.length, data: preAuths });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/tpa/pre-auth/:id/respond — record the TPA's decision (staff manually enters what the TPA said, since this isn't a live TPA API integration)
exports.respondToPreAuth = async (req, res) => {
  try {
    const { decision, approvedAmount, queryNote, rejectionReason, tpaReferenceNumber, validTill } = req.body; // decision: 'approve' | 'partial' | 'reject' | 'query'
    const preAuth = await PreAuthRequest.findById(req.params.id).populate('patient', 'name');
    if (!preAuth) return res.status(404).json({ success: false, error: 'Pre-authorization not found' });
    if (['approved','partially_approved','rejected'].includes(preAuth.status)) {
      return res.status(400).json({ success: false, error: `This pre-auth is already "${preAuth.status}" — respond isn't allowed after a final decision` });
    }

    if (decision === 'approve' || decision === 'partial') {
      if (approvedAmount === undefined || Number(approvedAmount) <= 0) return res.status(400).json({ success: false, error: 'Enter a valid approved amount' });
      preAuth.status = Number(approvedAmount) < preAuth.estimatedAmount ? 'partially_approved' : 'approved';
      preAuth.approvedAmount = Number(approvedAmount);
      preAuth.validTill = validTill ? new Date(validTill) : new Date(Date.now() + 15*24*60*60*1000); // default 15-day validity
    } else if (decision === 'reject') {
      preAuth.status = 'rejected';
      preAuth.rejectionReason = rejectionReason?.trim() || '';
    } else if (decision === 'query') {
      preAuth.status = 'query_raised';
      preAuth.queryNote = queryNote?.trim() || '';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid decision' });
    }
    if (tpaReferenceNumber) preAuth.tpaReferenceNumber = tpaReferenceNumber.trim();
    preAuth.respondedBy = req.user.id;
    preAuth.respondedAt = new Date();
    await preAuth.save();

    await notify(req, preAuth.patient._id, {
      type: 'preauth_responded', title: `🛡️ Pre-auth ${preAuth.status.replace('_',' ')}`,
      message: `${preAuth.preAuthNumber} — ${preAuth.status === 'query_raised' ? preAuth.queryNote : preAuth.status === 'rejected' ? preAuth.rejectionReason : `₹${preAuth.approvedAmount.toLocaleString('en-IN')} approved`}`,
      link: '/insurance', icon: '🛡️',
    });

    res.json({ success: true, data: preAuth });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/tpa/pre-auth/:id/cancel
exports.cancelPreAuth = async (req, res) => {
  try {
    const preAuth = await PreAuthRequest.findById(req.params.id);
    if (!preAuth) return res.status(404).json({ success: false, error: 'Pre-authorization not found' });
    if (['approved','partially_approved','rejected'].includes(preAuth.status)) {
      return res.status(400).json({ success: false, error: `Cannot cancel a pre-auth that's already ${preAuth.status}` });
    }
    preAuth.status = 'expired';
    await preAuth.save();
    res.json({ success: true, data: preAuth });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
