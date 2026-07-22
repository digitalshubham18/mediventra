const DialysisSession = require('../models/DialysisSession');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');
const { notify } = require('../utils/notify');

const POP = [
  { path: 'patient', select: 'name phone age bloodGroup' },
  { path: 'scheduledBy', select: 'name' },
  { path: 'assignedTech', select: 'name' },
  { path: 'consumablesUsed.item', select: 'name unit' },
];

// POST /api/dialysis/sessions
exports.scheduleSession = async (req, res) => {
  try {
    const { patient, assignedTech, stationNumber, accessType, dialyzerType, scheduledDate, scheduledStart, scheduledDurationMinutes, notes } = req.body;
    if (!patient || !scheduledDate || !scheduledStart) {
      return res.status(400).json({ success: false, error: 'Patient, date, and start time are required' });
    }

    // Prevent double-booking the same station at an overlapping time.
    if (stationNumber) {
      const dayStart = new Date(scheduledDate); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(scheduledDate); dayEnd.setHours(23,59,59,999);
      const clash = await DialysisSession.findOne({
        stationNumber, scheduledDate: { $gte: dayStart, $lte: dayEnd },
        scheduledStart, status: { $in: ['scheduled', 'in_progress'] },
      });
      if (clash) return res.status(400).json({ success: false, error: `Station ${stationNumber} is already booked at ${scheduledStart} on this date` });
    }

    const session = await DialysisSession.create({
      patient, scheduledBy: req.user.id, assignedTech: assignedTech || null,
      stationNumber: stationNumber?.trim() || '', accessType: accessType || '', dialyzerType: dialyzerType?.trim() || '',
      scheduledDate: new Date(scheduledDate), scheduledStart, scheduledDurationMinutes: scheduledDurationMinutes || 240,
      notes: notes?.trim() || '',
    });
    await session.populate(POP);

    await notify(req, patient, {
      type: 'dialysis_scheduled', title: '💉 Dialysis session scheduled',
      message: `${new Date(scheduledDate).toLocaleDateString('en-IN')} at ${scheduledStart}`,
      link: '/dialysis', icon: '💉',
    });
    if (assignedTech) {
      await notify(req, assignedTech, {
        type: 'dialysis_assigned', title: '💉 Dialysis session assigned',
        message: `${session.patient.name} — ${new Date(scheduledDate).toLocaleDateString('en-IN')} at ${scheduledStart}`,
        link: '/dialysis', icon: '💉',
      });
    }

    res.status(201).json({ success: true, data: session });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/dialysis/sessions?status=&patientId=&date=
exports.getSessions = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.patient = req.user.id;
    else if (req.query.patientId) q.patient = req.query.patientId;
    if (req.query.status) q.status = req.query.status;
    if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const p = req.query.date.split('-').map(Number);
      q.scheduledDate = { $gte: new Date(p[0],p[1]-1,p[2],0,0,0,0), $lte: new Date(p[0],p[1]-1,p[2],23,59,59,999) };
    }
    if (req.user.role === 'dialysis_tech' && req.query.mine === '1') q.assignedTech = req.user.id;
    const sessions = await DialysisSession.find(q).populate(POP).sort({ scheduledDate: 1, scheduledStart: 1 });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/dialysis/sessions/today
exports.getToday = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    const sessions = await DialysisSession.find({ scheduledDate: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } }).populate(POP).sort({ scheduledStart: 1 });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/dialysis/sessions/:id/start — record pre-session vitals
exports.startSession = async (req, res) => {
  try {
    const { weight, bloodPressure, pulse, temperature } = req.body;
    const session = await DialysisSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.status !== 'scheduled') return res.status(400).json({ success: false, error: `Cannot start from status "${session.status}"` });

    session.status = 'in_progress';
    session.actualStart = new Date();
    session.preVitals = { weight, bloodPressure, pulse, temperature };
    session.assignedTech = session.assignedTech || req.user.id;
    await session.save();
    await session.populate(POP);
    res.json({ success: true, data: session });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/dialysis/sessions/:id/complete — post vitals + consumables used (deducts stock)
exports.completeSession = async (req, res) => {
  try {
    const { weight, bloodPressure, pulse, temperature, complications, notes, consumablesUsed } = req.body;
    const session = await DialysisSession.findById(req.params.id).populate('patient', 'name');
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Session must be in progress to complete it' });

    const items = Array.isArray(consumablesUsed) ? consumablesUsed.filter(c => c.item && c.quantity > 0) : [];

    // Check stock for everything before deducting anything.
    for (const c of items) {
      const item = await InventoryItem.findById(c.item);
      if (!item) return res.status(404).json({ success: false, error: 'One of the consumables was not found' });
      if (item.currentStock < c.quantity) {
        return res.status(400).json({ success: false, error: `Not enough stock for ${item.name} (have ${item.currentStock}, need ${c.quantity})` });
      }
    }
    for (const c of items) {
      const item = await InventoryItem.findById(c.item);
      item.currentStock -= c.quantity;
      await item.save();
      await StockTransaction.create({ item: item._id, type: 'out', quantity: c.quantity, reason: `Dialysis session — ${session.patient.name}`, balanceAfter: item.currentStock, performedBy: req.user.id });
    }

    session.status = 'completed';
    session.actualEnd = new Date();
    session.durationMinutes = session.actualStart ? Math.round((session.actualEnd - session.actualStart) / 60000) : null;
    session.postVitals = { weight, bloodPressure, pulse, temperature };
    session.complications = complications?.trim() || '';
    session.notes = notes?.trim() || session.notes;
    session.consumablesUsed = items;
    await session.save();
    await session.populate(POP);

    res.json({ success: true, data: session });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST /api/dialysis/sessions/:id/repeat — quickly schedule the next recurring session
exports.repeatSession = async (req, res) => {
  try {
    const prev = await DialysisSession.findById(req.params.id);
    if (!prev) return res.status(404).json({ success: false, error: 'Session not found' });
    const nextDate = new Date(prev.scheduledDate);
    nextDate.setDate(nextDate.getDate() + (prev.recurrenceDays || 7));

    const next = await DialysisSession.create({
      patient: prev.patient, scheduledBy: req.user.id, assignedTech: prev.assignedTech,
      stationNumber: prev.stationNumber, accessType: prev.accessType, dialyzerType: prev.dialyzerType,
      scheduledDate: nextDate, scheduledStart: prev.scheduledStart, scheduledDurationMinutes: prev.scheduledDurationMinutes,
      recurrenceDays: prev.recurrenceDays,
    });
    await next.populate(POP);
    res.status(201).json({ success: true, data: next });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/dialysis/sessions/:id/cancel
exports.cancelSession = async (req, res) => {
  try {
    const { reason, noShow } = req.body;
    const session = await DialysisSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (['completed', 'cancelled', 'no_show'].includes(session.status)) return res.status(400).json({ success: false, error: `Cannot cancel a session that is already ${session.status}` });
    session.status = noShow ? 'no_show' : 'cancelled';
    session.cancelReason = reason?.trim() || '';
    await session.save();
    res.json({ success: true, data: session });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
