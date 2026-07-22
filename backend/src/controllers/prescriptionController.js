const Prescription = require('../models/Prescription');
const { notify } = require('../utils/notify');

// POST /api/prescriptions — doctor issues a prescription
exports.create = async (req, res) => {
  try {
    const { patient, appointment, diagnosis, medicines, followUpDate, notes } = req.body;
    if (!patient || !diagnosis?.trim()) return res.status(400).json({ success: false, error: 'Patient and diagnosis are required' });
    const cleanMeds = (medicines || []).filter(m => m.name?.trim() || m.med?.trim()).map(m => ({
      name: (m.name || m.med || '').trim(), dosage: m.dosage || '', duration: m.duration || '', instructions: m.instructions || '',
    }));
    if (cleanMeds.length === 0) return res.status(400).json({ success: false, error: 'Add at least one medicine' });

    const prescription = await Prescription.create({
      patient, doctor: req.user.id, appointment: appointment || null,
      diagnosis: diagnosis.trim(), medicines: cleanMeds,
      followUpDate: followUpDate || null, notes: notes?.trim() || '',
    });
    await prescription.populate('doctor', 'name specialization');

    await notify(req, patient, {
      type: 'prescription_issued', title: '📝 New prescription', message: `Dr. ${req.user.name} prescribed ${cleanMeds.length} medicine${cleanMeds.length!==1?'s':''} for ${diagnosis.trim()}`,
      link: '/prescriptions', icon: '📝',
    });

    res.status(201).json({ success: true, data: prescription });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/prescriptions/mine — patient's own prescriptions
exports.getForPatient = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patient: req.user.id }).populate('doctor', 'name specialization').sort({ createdAt: -1 });
    res.json({ success: true, data: prescriptions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/prescriptions/issued — doctor's own issued prescriptions
exports.getByDoctor = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctor: req.user.id }).populate('patient', 'name phone').sort({ createdAt: -1 });
    res.json({ success: true, data: prescriptions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/prescriptions/:id
exports.getOne = async (req, res) => {
  try {
    const rx = await Prescription.findById(req.params.id).populate('doctor', 'name specialization').populate('patient', 'name phone');
    if (!rx) return res.status(404).json({ success: false, error: 'Prescription not found' });
    const isOwner = String(rx.patient._id) === req.user.id || String(rx.doctor._id) === req.user.id;
    if (!isOwner && !['admin', 'pharmacist'].includes(req.user.role)) return res.status(403).json({ success: false, error: 'Not authorized to view this prescription' });
    res.json({ success: true, data: rx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
