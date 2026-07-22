const User = require('../models/User');
const HealthRecord = require('../models/HealthRecord');
const Prescription = require('../models/Prescription');
const HealthCertificate = require('../models/HealthCertificate');
const WearableEntry = require('../models/WearableEntry');
const HospitalConfig = require('../models/HospitalConfig');
const { generateHealthSummaryPDF } = require('../utils/healthSummaryGenerator');

// GET /api/health-summary/:patientId? — patients download their own; a
// treating doctor or admin/nurse can download for a given patient. Mirrors
// the ownership rule already used for records/certificates elsewhere.
exports.download = async (req, res) => {
  try {
    const targetId = req.params.patientId || req.user.id;

    if (targetId !== req.user.id && !['doctor', 'admin', 'nurse'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this patient\u2019s health summary' });
    }

    const patient = await User.findById(targetId).select('name age gender bloodGroup phone role');
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const [records, prescriptions, certificates, latestVitals, config] = await Promise.all([
      HealthRecord.find({ patient: targetId }).sort({ createdAt: -1 }).limit(10).populate('doctor', 'name'),
      Prescription.find({ patient: targetId }).sort({ createdAt: -1 }).limit(10).populate('doctor', 'name'),
      HealthCertificate.find({ patient: targetId }).sort({ createdAt: -1 }).limit(10),
      WearableEntry.findOne({ patient: targetId }).sort({ date: -1 }),
      HospitalConfig.findOne(),
    ]);

    const pdfBuffer = await generateHealthSummaryPDF({
      patient, records, prescriptions, certificates, latestVitals,
      hospitalName: config?.hospitalName || 'Mediventra',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="health-summary-${patient.name.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
