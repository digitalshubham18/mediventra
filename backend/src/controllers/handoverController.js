const Handover = require('../models/Handover');

// GET /api/handovers?role=nurse — most recent handover notes for a role
exports.getForRole = async (req, res) => {
  try {
    const role = req.query.role || req.user.role;
    const notes = await Handover.find({ fromRole: role }).populate('fromUser', 'name').sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: notes });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { shift, criticalPatients, pendingTasks, notes } = req.body;
    if (!shift) return res.status(400).json({ success: false, error: 'shift is required' });
    const handover = await Handover.create({
      fromUser: req.user.id, fromRole: req.user.role, shift, criticalPatients, pendingTasks, notes,
    });
    const io = req.app.get('io');
    if (io) io.emit('handover_created', { role: req.user.role, fromName: req.user.name });
    res.status(201).json({ success: true, data: handover });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/handovers/:id/acknowledge — incoming shift confirms they've read it
exports.acknowledge = async (req, res) => {
  try {
    const handover = await Handover.findByIdAndUpdate(req.params.id, { $addToSet: { acknowledgedBy: req.user.id } }, { new: true });
    if (!handover) return res.status(404).json({ success: false, error: 'Handover not found' });
    res.json({ success: true, data: handover });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
