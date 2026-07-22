const RefillRequest = require('../models/RefillRequest');
const Prescription = require('../models/Prescription');
const { notify } = require('../utils/notify');

// POST /api/refill-requests — patient requests a refill against one of
// their existing prescriptions, without booking a whole new appointment.
exports.create = async (req, res) => {
  try {
    const { prescriptionId, medicines, reason } = req.body;
    const prescription = await Prescription.findOne({ _id: prescriptionId, patient: req.user.id });
    if (!prescription) return res.status(404).json({ success: false, error: 'Prescription not found' });

    const alreadyPending = await RefillRequest.findOne({ prescription: prescriptionId, patient: req.user.id, status: 'pending' });
    if (alreadyPending) return res.status(400).json({ success: false, error: 'You already have a pending refill request for this prescription' });

    const refill = await RefillRequest.create({
      patient: req.user.id, prescription: prescriptionId, doctor: prescription.doctor,
      medicines: medicines?.length ? medicines : prescription.medicines.map(m => m.name),
      reason: reason?.trim() || '',
    });
    await refill.populate('patient', 'name phone');

    await notify(req, prescription.doctor, {
      type: 'refill_requested', title: '💊 Refill request', message: `${req.user.name} requested a refill for: ${refill.medicines.join(', ')}`,
      link: '/prescriptions', icon: '💊',
    });

    res.status(201).json({ success: true, data: refill });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/refill-requests/mine — patient's own refill requests
exports.getMine = async (req, res) => {
  try {
    const requests = await RefillRequest.find({ patient: req.user.id }).populate('prescription', 'diagnosis').populate('doctor', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/refill-requests/for-review — doctor/pharmacist sees requests to act on
exports.getForReview = async (req, res) => {
  try {
    const q = req.user.role === 'doctor' ? { doctor: req.user.id } : {};
    if (req.query.status) q.status = req.query.status;
    const requests = await RefillRequest.find(q).populate('patient', 'name phone').populate('prescription', 'diagnosis medicines').populate('doctor', 'name').sort({ status: 1, createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/refill-requests/:id/review — doctor approves/rejects
exports.review = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const refill = await RefillRequest.findById(req.params.id).populate('patient', 'name');
    if (!refill) return res.status(404).json({ success: false, error: 'Request not found' });
    if (refill.status !== 'pending') return res.status(400).json({ success: false, error: 'This request has already been reviewed' });
    if (req.user.role === 'doctor' && String(refill.doctor) !== req.user.id) return res.status(403).json({ success: false, error: 'Not your patient\u2019s request' });

    refill.status = status;
    refill.reviewedBy = req.user.id;
    refill.reviewNotes = reviewNotes?.trim() || '';
    refill.reviewedAt = new Date();
    await refill.save();

    await notify(req, refill.patient._id, {
      type: 'refill_reviewed', title: status === 'approved' ? '✅ Refill approved' : '❌ Refill declined',
      message: status === 'approved' ? `Your refill for ${refill.medicines.join(', ')} was approved — visit the pharmacy to collect it.` : (refill.reviewNotes || 'Your refill request was declined'),
      link: '/prescriptions', icon: status === 'approved' ? '✅' : '❌',
    });

    res.json({ success: true, data: refill });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
