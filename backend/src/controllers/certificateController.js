const HealthCertificate = require('../models/HealthCertificate');
const { notify } = require('../utils/notify');

const genCertNumber = () => 'CERT-' + new Date().getFullYear() + '-' + Date.now().toString(36).toUpperCase().slice(-6);

// POST /api/certificates — doctor issues a certificate
exports.create = async (req, res) => {
  try {
    const { patientId, type, purpose, diagnosis, findings, restAdvice, leaveFrom, leaveTo, bloodGroup } = req.body;
    if (!patientId || !type || !purpose?.trim()) {
      return res.status(400).json({ success: false, error: 'Patient, certificate type, and purpose are required' });
    }
    if (type === 'medical_leave' && (!leaveFrom || !leaveTo)) {
      return res.status(400).json({ success: false, error: 'Leave start and end dates are required for a medical leave certificate' });
    }
    if (leaveFrom && leaveTo && new Date(leaveTo) < new Date(leaveFrom)) {
      return res.status(400).json({ success: false, error: 'Leave end date must be on or after the start date' });
    }
    const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
    if (type === 'blood_group' && !BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ success: false, error: 'A valid blood group is required for a blood group certificate' });
    }

    const cert = await HealthCertificate.create({
      patient: patientId, doctor: req.user.id, type, purpose: purpose.trim(),
      diagnosis: diagnosis?.trim() || '', findings: findings?.trim() || '', restAdvice: restAdvice?.trim() || '',
      leaveFrom: leaveFrom || null, leaveTo: leaveTo || null,
      bloodGroup: type === 'blood_group' ? bloodGroup : '',
      certificateNumber: genCertNumber(),
    });
    await cert.populate('doctor', 'name specialization licenseNumber');
    await cert.populate('patient', 'name age gender');

    await notify(req, patientId, {
      type: 'certificate_issued', title: '📄 Certificate issued',
      message: `Dr. ${req.user.name} issued you a ${type.replace('_',' ')} certificate`,
      link: '/certificates', icon: '📄',
    });

    res.status(201).json({ success: true, data: cert });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/certificates/mine — patient's own certificates
exports.getForPatient = async (req, res) => {
  try {
    const certs = await HealthCertificate.find({ patient: req.user.id }).populate('doctor', 'name specialization licenseNumber').sort({ createdAt: -1 });
    res.json({ success: true, data: certs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/certificates/issued — doctor's own issued certificates
exports.getByDoctor = async (req, res) => {
  try {
    const certs = await HealthCertificate.find({ doctor: req.user.id }).populate('patient', 'name phone').sort({ createdAt: -1 });
    res.json({ success: true, data: certs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/certificates/:id
exports.getOne = async (req, res) => {
  try {
    const cert = await HealthCertificate.findById(req.params.id).populate('doctor', 'name specialization licenseNumber').populate('patient', 'name age gender phone');
    if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });
    const isOwner = String(cert.patient._id) === req.user.id || String(cert.doctor?._id) === req.user.id;
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Not authorized to view this certificate' });
    res.json({ success: true, data: cert });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
