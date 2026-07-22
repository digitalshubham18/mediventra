const Surgery = require('../models/Surgery');
const OTRoom  = require('../models/OTRoom');
const User    = require('../models/User');
const { notify } = require('../utils/notify');

const POP = [
  { path: 'patient', select: 'name phone age bloodGroup' },
  { path: 'primarySurgeon', select: 'name specialization' },
  { path: 'assistants', select: 'name specialization' },
  { path: 'anesthetist', select: 'name' },
  { path: 'nurses', select: 'name' },
  { path: 'otRoom', select: 'name number floor type' },
];

// POST /api/surgeries — schedule a new surgery, preventing OT room double-booking
exports.scheduleSurgery = async (req, res) => {
  try {
    const {
      patient, procedureName, reason, primarySurgeon, assistants, anesthetist, nurses,
      otRoom, scheduledStart, scheduledEnd, notes,
    } = req.body;

    const missing = [];
    if (!patient) missing.push('patient');
    if (!procedureName?.trim()) missing.push('procedure name');
    if (!primarySurgeon) missing.push('primary surgeon');
    if (!otRoom) missing.push('OT room');
    if (!scheduledStart) missing.push('scheduled start time');
    if (!scheduledEnd) missing.push('scheduled end time');
    if (missing.length) return res.status(400).json({ success: false, error: `Please provide: ${missing.join(', ')}.` });

    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    if (end <= start) return res.status(400).json({ success: false, error: 'End time must be after start time' });

    const room = await OTRoom.findById(otRoom);
    if (!room) return res.status(404).json({ success: false, error: 'OT room not found' });
    if (room.type !== 'OT') return res.status(400).json({ success: false, error: `${room.name} is not an OT room (type: ${room.type})` });

    // Double-booking prevention — any active surgery in the same room whose
    // scheduled window overlaps this one blocks the new booking.
    const overlapping = await Surgery.findOne({
      otRoom,
      status: { $in: ['scheduled', 'pre_op', 'in_progress'] },
      scheduledStart: { $lt: end },
      scheduledEnd: { $gt: start },
    }).populate('patient', 'name');
    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: `${room.name} is already booked for ${overlapping.patient?.name} from ${new Date(overlapping.scheduledStart).toLocaleString('en-IN')} to ${new Date(overlapping.scheduledEnd).toLocaleString('en-IN')}. Choose a different time or room.`,
        roomBusy: true,
      });
    }

    const surgery = await Surgery.create({
      patient, procedureName: procedureName.trim(), reason: reason?.trim() || '',
      primarySurgeon, assistants: assistants || [], anesthetist: anesthetist || null, nurses: nurses || [],
      otRoom, scheduledStart: start, scheduledEnd: end, notes: notes?.trim() || '',
      createdBy: req.user.id,
    });
    await surgery.populate(POP);

    // Notify the surgical team + OT boys so they know to prep.
    const teamIds = [primarySurgeon, anesthetist, ...(assistants||[]), ...(nurses||[])].filter(Boolean);
    for (const uid of teamIds) {
      await notify(req, uid, {
        type: 'surgery_scheduled', title: '🔪 Surgery scheduled',
        message: `${surgery.procedureName} — ${surgery.patient.name} — ${start.toLocaleString('en-IN')} in ${room.name}`,
        link: '/surgeries', icon: '🔪',
      });
    }
    const otBoys = await User.find({ role: 'otboy', status: 'approved' }).select('_id');
    for (const ob of otBoys) {
      await notify(req, ob._id, {
        type: 'surgery_scheduled', title: '🔪 New surgery to prep for',
        message: `${room.name} — ${surgery.procedureName} at ${start.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        link: '/dashboard', icon: '🔪',
      });
    }

    const io = req.app.get('io');
    if (io) io.emit('surgery_scheduled', { surgeryId: surgery._id, room: room.name, patient: surgery.patient.name });

    res.status(201).json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/surgeries?status=&date=&roomId=&surgeonId=
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.roomId) q.otRoom = req.query.roomId;
    if (req.query.surgeonId) q.primarySurgeon = req.query.surgeonId;
    if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const p = req.query.date.split('-').map(Number);
      q.scheduledStart = { $gte: new Date(p[0],p[1]-1,p[2],0,0,0,0), $lte: new Date(p[0],p[1]-1,p[2],23,59,59,999) };
    }
    if (req.user.role === 'doctor') {
      q.$or = [{ primarySurgeon: req.user.id }, { assistants: req.user.id }, { anesthetist: req.user.id }];
    }
    const surgeries = await Surgery.find(q).populate(POP).sort({ scheduledStart: 1 });
    res.json({ success: true, count: surgeries.length, data: surgeries });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/surgeries/today — used by the OT Boy dashboard ("Today's Surgeries")
exports.getToday = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    const surgeries = await Surgery.find({
      scheduledStart: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' },
    }).populate(POP).sort({ scheduledStart: 1 });
    res.json({ success: true, count: surgeries.length, data: surgeries });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/surgeries/:id
exports.getOne = async (req, res) => {
  try {
    const surgery = await Surgery.findById(req.params.id).populate(POP);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/surgeries/:id/checklist — toggle one checklist item
exports.updateChecklistItem = async (req, res) => {
  try {
    const { itemIndex, checked } = req.body;
    const surgery = await Surgery.findById(req.params.id);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    if (!surgery.checklist[itemIndex]) return res.status(400).json({ success: false, error: 'Invalid checklist item' });

    surgery.checklist[itemIndex].checked = !!checked;
    surgery.checklist[itemIndex].checkedBy = checked ? req.user.id : null;
    surgery.checklist[itemIndex].checkedAt = checked ? new Date() : null;
    await surgery.save();
    await surgery.populate(POP);
    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/surgeries/:id/move-to-pre-op — Scheduled → Pre-Op
exports.moveToPreOp = async (req, res) => {
  try {
    const surgery = await Surgery.findById(req.params.id);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    if (surgery.status !== 'scheduled') return res.status(400).json({ success: false, error: `Cannot move to Pre-Op from status "${surgery.status}"` });
    surgery.status = 'pre_op';
    await surgery.save();
    await surgery.populate(POP);
    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/surgeries/:id/start — Pre-Op → In Progress. Requires the WHO
// pre-op checklist (Sign In + Time Out phases) to be 100% complete — this is
// the whole point of a pre-op safety checklist, so it's enforced server-side
// and not just as a UI nicety.
exports.startSurgery = async (req, res) => {
  try {
    const surgery = await Surgery.findById(req.params.id);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    if (!['scheduled', 'pre_op'].includes(surgery.status)) {
      return res.status(400).json({ success: false, error: `Cannot start surgery from status "${surgery.status}"` });
    }
    const preOpItems = surgery.checklist.filter(c => c.phase === 'sign_in' || c.phase === 'time_out');
    const incomplete = preOpItems.filter(c => !c.checked);
    if (incomplete.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Pre-op safety checklist is not 100% complete (${incomplete.length} item${incomplete.length!==1?'s':''} remaining). Every Sign In and Time Out item must be checked before starting.`,
        checklistIncomplete: true,
        remaining: incomplete.map(c => c.item),
      });
    }
    surgery.status = 'in_progress';
    surgery.actualStart = new Date();
    await surgery.save();
    await surgery.populate(POP);

    const io = req.app.get('io');
    if (io) io.emit('surgery_started', { surgeryId: surgery._id, room: surgery.otRoom.name });

    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/surgeries/:id/complete — In Progress → Completed, captures actual duration
exports.completeSurgery = async (req, res) => {
  try {
    const { postOpNotes } = req.body;
    const surgery = await Surgery.findById(req.params.id);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    if (surgery.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Surgery must be In Progress to complete it' });

    surgery.actualEnd = new Date();
    surgery.durationMinutes = Math.round((surgery.actualEnd - surgery.actualStart) / 60000);
    surgery.postOpNotes = postOpNotes?.trim() || '';
    surgery.status = 'completed';
    await surgery.save();
    await surgery.populate(POP);

    const io = req.app.get('io');
    if (io) io.emit('surgery_completed', { surgeryId: surgery._id, room: surgery.otRoom.name });

    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/surgeries/:id/cancel
exports.cancelSurgery = async (req, res) => {
  try {
    const { reason } = req.body;
    const surgery = await Surgery.findById(req.params.id);
    if (!surgery) return res.status(404).json({ success: false, error: 'Surgery not found' });
    if (['completed', 'cancelled'].includes(surgery.status)) return res.status(400).json({ success: false, error: `Cannot cancel a surgery that is already ${surgery.status}` });
    surgery.status = 'cancelled';
    surgery.cancelReason = reason?.trim() || '';
    await surgery.save();
    res.json({ success: true, data: surgery });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
