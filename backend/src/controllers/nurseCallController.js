const NurseCall = require('../models/NurseCall');
const Admission = require('../models/Admission');
const User = require('../models/User');
const { notify } = require('../utils/notify');

// POST /api/nurse-calls — patient presses the call button
exports.create = async (req, res) => {
  try {
    const admission = await Admission.findOne({ patient: req.user.id, status: 'admitted' }).populate('room', 'number type floor');
    if (!admission) return res.status(400).json({ success: false, error: 'No active admission found — the nurse call button is only available to currently admitted patients' });

    const alreadyActive = await NurseCall.findOne({ patient: req.user.id, status: { $in: ['active', 'acknowledged'] } });
    if (alreadyActive) return res.status(400).json({ success: false, error: 'You already have an active call — a nurse has been notified' });

    const call = await NurseCall.create({
      patient: req.user.id, admission: admission._id, room: admission.room._id,
      reason: req.body.reason?.trim() || '',
    });

    const io = req.app.get('io');
    const location = `${admission.room.type} — Room ${admission.room.number}, Floor ${admission.room.floor}`;
    if (io) io.emit('nurse_call', { callId: call._id, patientName: req.user.name, location, reason: call.reason });

    // Notify every on-duty nurse's personal room, plus a broadcast so any
    // nurse dashboard currently open picks it up live even without a
    // dedicated per-user room join for this event type.
    const nurses = await User.find({ role: 'nurse', status: 'approved' }).select('_id');
    await Promise.all(nurses.map(n => notify(req, n._id, {
      type: 'nurse_call', title: `🔔 Nurse call — ${location}`,
      message: `${req.user.name}${call.reason ? `: ${call.reason}` : ' needs assistance'}`,
      link: '/staff-dashboard', icon: '🔔',
    })));

    res.status(201).json({ success: true, data: call });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/nurse-calls — nurse sees all active/acknowledged calls hospital-wide
exports.getActive = async (req, res) => {
  try {
    const calls = await NurseCall.find({ status: { $in: ['active', 'acknowledged'] } })
      .populate('patient', 'name')
      .populate('room', 'number type floor')
      .populate('acknowledgedBy', 'name')
      .sort({ status: 1, createdAt: 1 });
    res.json({ success: true, data: calls });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/nurse-calls/mine — patient checks their own call status
exports.getMine = async (req, res) => {
  try {
    const call = await NurseCall.findOne({ patient: req.user.id, status: { $in: ['active', 'acknowledged'] } }).populate('acknowledgedBy', 'name');
    res.json({ success: true, data: call });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/nurse-calls/:id/acknowledge — a nurse is on their way
exports.acknowledge = async (req, res) => {
  try {
    const call = await NurseCall.findByIdAndUpdate(req.params.id, {
      status: 'acknowledged', acknowledgedBy: req.user.id, acknowledgedAt: new Date(),
    }, { new: true }).populate('patient', 'name');
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });

    const io = req.app.get('io');
    if (io) io.emit('nurse_call_updated', { callId: call._id, status: 'acknowledged', nurseName: req.user.name });
    await notify(req, call.patient._id, { type:'nurse_call_updated', title:'🩺 A nurse is on the way', message:`${req.user.name} is coming to assist you`, link:'/dashboard', icon:'🩺' });

    res.json({ success: true, data: call });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/nurse-calls/:id/resolve
exports.resolve = async (req, res) => {
  try {
    const call = await NurseCall.findByIdAndUpdate(req.params.id, {
      status: 'resolved', resolvedAt: new Date(),
    }, { new: true });
    if (!call) return res.status(404).json({ success: false, error: 'Call not found' });
    const io = req.app.get('io');
    if (io) io.emit('nurse_call_updated', { callId: call._id, status: 'resolved' });
    res.json({ success: true, data: call });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
