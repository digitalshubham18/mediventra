const PeerConsult = require('../models/PeerConsult');
const User = require('../models/User');

// GET /api/peer-consults/sent — cases I've shared with others
exports.getSent = async (req, res) => {
  try {
    const items = await PeerConsult.find({ fromDoctor: req.user.id }).populate('toDoctor', 'name specialization').sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/peer-consults/received — cases shared with me for a second opinion
exports.getReceived = async (req, res) => {
  try {
    const items = await PeerConsult.find({ toDoctor: req.user.id }).populate('fromDoctor', 'name specialization').sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/peer-consults/specialists — other doctors available to consult
exports.getSpecialists = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', status: 'approved', _id: { $ne: req.user.id } })
      .select('name specialization department avatar');
    res.json({ success: true, data: doctors });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/peer-consults — share an anonymized case
exports.create = async (req, res) => {
  try {
    const { toDoctorId, ageBand, gender, summary, diagnosis, testResults } = req.body;
    if (!toDoctorId || !summary) return res.status(400).json({ success: false, error: 'Recipient doctor and a case summary are required' });
    const consult = await PeerConsult.create({
      fromDoctor: req.user.id, toDoctor: toDoctorId, ageBand, gender, summary, diagnosis, testResults,
    });
    const io = req.app.get('io');
    if (io) io.to(`user_${toDoctorId}`).emit('peer_consult_received', { fromDoctorName: req.user.name });
    res.status(201).json({ success: true, data: consult });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/peer-consults/:id/respond
exports.respond = async (req, res) => {
  try {
    const consult = await PeerConsult.findOne({ _id: req.params.id, toDoctor: req.user.id });
    if (!consult) return res.status(404).json({ success: false, error: 'Consultation not found' });
    consult.response = req.body.response;
    consult.status = 'responded';
    consult.respondedAt = new Date();
    await consult.save();
    res.json({ success: true, data: consult });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
