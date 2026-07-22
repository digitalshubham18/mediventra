const QueueToken = require('../models/QueueToken');
const { notify } = require('../utils/notify');

// IMPORTANT: uses the server's LOCAL calendar date, not UTC. `toISOString()`
// always returns UTC, which silently shifts "today" by several hours for
// any server not physically running in UTC+0 — a token created at, say,
// 1am IST would get filed under the previous UTC day and vanish from
// "today's" queue entirely. This keeps every date grouped by the same
// wall-clock day the receptionist/patient actually experiences.
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// GET /api/queue — today's queue, optionally filtered by department
exports.getQueue = async (req, res) => {
  try {
    const q = { date: todayStr() };
    if (req.query.department) q.department = req.query.department;
    if (req.query.status) q.status = req.query.status;
    const tokens = await QueueToken.find(q).populate('doctor', 'name').populate('createdBy', 'name').sort({ department: 1, tokenNumber: 1 });
    res.json({ success: true, data: tokens });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/queue — receptionist registers a walk-in, or a patient
// self-registers for a token (their name/phone are pulled from their
// account automatically in that case).
exports.createToken = async (req, res) => {
  try {
    let { department, patientName, phone, purpose, doctorId, patientId } = req.body;
    if (req.user.role === 'patient') {
      patientId = req.user.id;
      patientName = patientName || req.user.name;
      phone = phone || req.user.phone;
    }
    if (!department || !patientName) return res.status(400).json({ success: false, error: 'Department and patient name are required' });

    const date = todayStr();
    // Token numbers reset daily per department (Cardiology's #1 today has
    // nothing to do with Orthopedics' #1) — found by counting today's
    // tokens for that department so far.
    const count = await QueueToken.countDocuments({ date, department });
    const token = await QueueToken.create({
      tokenNumber: count + 1, department, patientName, phone: phone || '',
      purpose: purpose || '', doctor: doctorId || undefined, patient: patientId || undefined,
      createdBy: req.user.id, date,
    });

    const io = req.app.get('io');
    if (io) io.emit('queue_token_created', { tokenId: token._id, department, tokenNumber: token.tokenNumber, patientName });

    res.status(201).json({ success: true, data: token });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/queue/:id/status — call next / start consultation / complete / no-show / cancel
exports.updateTokenStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['called','in_consultation','completed','no_show','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const token = await QueueToken.findById(req.params.id);
    if (!token) return res.status(404).json({ success: false, error: 'Token not found' });

    token.status = status;
    if (status === 'called') token.calledAt = new Date();
    if (status === 'in_consultation') token.startedAt = new Date();
    if (['completed','no_show','cancelled'].includes(status)) token.completedAt = new Date();
    await token.save();

    const io = req.app.get('io');
    if (io) io.emit('queue_token_updated', { tokenId: token._id, department: token.department, tokenNumber: token.tokenNumber, status, patientName: token.patientName });
    if (token.patient && ['called','in_consultation'].includes(status)) {
      await notify(req, token.patient, {
        type: 'queue_token_updated',
        title: status === 'called' ? `🎫 You're up next — Token #${token.tokenNumber}` : `🩺 Now with the doctor — Token #${token.tokenNumber}`,
        message: `${token.department} — please head to the counter now.`,
        link: '/dashboard', icon: '🎫',
      });
    }

    res.json({ success: true, data: token });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/queue/mine — a patient checks their own token(s) for today,
// including how many people are still waiting ahead of them.
exports.getMine = async (req, res) => {
  try {
    const date = todayStr();
    const mine = await QueueToken.find({ date, patient: req.user.id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
    const withPosition = await Promise.all(mine.map(async t => {
      const waitingAhead = t.status === 'waiting'
        ? await QueueToken.countDocuments({ date, department: t.department, status: 'waiting', tokenNumber: { $lt: t.tokenNumber } })
        : 0;
      return { ...t.toObject(), waitingAhead };
    }));
    res.json({ success: true, data: withPosition });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/queue/public/board — no-auth kiosk/waiting-room display: the
// "now serving" token per department, plus how many are still waiting.
exports.getPublicBoard = async (req, res) => {
  try {
    const date = todayStr();
    const tokens = await QueueToken.find({ date }).sort({ department: 1, tokenNumber: 1 });
    const byDept = {};
    tokens.forEach(t => {
      byDept[t.department] = byDept[t.department] || { department: t.department, nowServing: null, waitingCount: 0, lastCompleted: null };
      if (['called', 'in_consultation'].includes(t.status)) {
        if (!byDept[t.department].nowServing || t.tokenNumber > byDept[t.department].nowServing.tokenNumber) {
          byDept[t.department].nowServing = { tokenNumber: t.tokenNumber, status: t.status };
        }
      }
      if (t.status === 'waiting') byDept[t.department].waitingCount += 1;
      if (t.status === 'completed') byDept[t.department].lastCompleted = t.tokenNumber;
    });
    res.json({ success: true, data: Object.values(byDept) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
