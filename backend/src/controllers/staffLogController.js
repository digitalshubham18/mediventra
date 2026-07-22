const StaffLog = require('../models/StaffLog');

// GET /api/stafflogs — staff see their own logs; admin/security supervisors see all
exports.getLogs = async (req, res) => {
  try {
    const q = {};
    // Visitor log entries are a shared front-desk/security record, not a
    // personal log — reception logs them, security needs to see the same
    // list to actually do anything with it (previously they got nothing,
    // since the default below scopes everyone to their own entries only).
    const sharedVisitorAccess = req.query.category === 'visitor_log' && ['receptionist','security','admin'].includes(req.user.role);
    if (!['admin'].includes(req.user.role) && !sharedVisitorAccess) q.user = req.user.id;
    if (req.query.category) q.category = req.query.category;
    if (req.query.status) q.status = req.query.status;
    const logs = await StaffLog.find(q)
      .populate('user', 'name role')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/stafflogs — staff create their own request/incident/log entry
exports.createLog = async (req, res) => {
  try {
    const { category, title, details, location, priority } = req.body;
    if (!category || !title) return res.status(400).json({ success: false, error: 'category and title are required' });
    const log = await StaffLog.create({
      user: req.user.id,
      role: req.user.role,
      category, title,
      details: details || '',
      location: location || '',
      priority: priority || 'medium',
    });
    await log.populate('user', 'name role');

    const io = req.app.get('io');
    if (io) io.emit('staff_log_created', { id: log._id, category: log.category, title: log.title, user: log.user.name, priority: log.priority });

    res.status(201).json({ success: true, data: log });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/stafflogs/:id/resolve — admin/supervisor marks it resolved
exports.resolveLog = async (req, res) => {
  try {
    const log = await StaffLog.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedBy: req.user.id, resolvedAt: new Date(), resolutionNotes: req.body.resolutionNotes || '' },
      { new: true }
    ).populate('user', 'name role').populate('resolvedBy', 'name');
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });
    res.json({ success: true, data: log });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/stafflogs/:id/close — the staff member who is handling it (e.g.
// security closing their own incident report once the task is complete)
// marks it closed. Restricted to the original creator, the same role as
// the creator (e.g. another security officer covering a shift), or admin —
// so one staff member can't close someone else's unrelated entry.
exports.closeLog = async (req, res) => {
  try {
    const log = await StaffLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });

    const isOwner   = log.user.toString() === req.user.id;
    const sameRole  = log.role === req.user.role;
    const isAdmin    = req.user.role === 'admin';
    const isSecurityOnVisitorLog = req.user.role === 'security' && log.category === 'visitor_log';
    if (!isOwner && !sameRole && !isAdmin && !isSecurityOnVisitorLog) {
      return res.status(403).json({ success: false, error: 'You can only close logs you created or that belong to your team.' });
    }

    log.status = 'closed';
    log.closedBy = req.user.id;
    log.closedAt = new Date();
    if (req.body.resolutionNotes) log.resolutionNotes = req.body.resolutionNotes;
    await log.save();
    await log.populate('user', 'name role');
    await log.populate('closedBy', 'name');

    const io = req.app.get('io');
    if (io) io.emit('staff_log_closed', { id: log._id, category: log.category, title: log.title });

    res.json({ success: true, data: log });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/stafflogs/:id — the staff member who created it, or admin,
// can remove it entirely (e.g. submitted by mistake, or a duplicate) —
// distinct from "close", which keeps the record but marks it done.
exports.deleteLog = async (req, res) => {
  try {
    const log = await StaffLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });

    const isOwner = log.user.toString() === req.user.id;
    const isAdmin  = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'You can only delete requests/logs you created yourself.' });
    }

    await log.deleteOne();

    const io = req.app.get('io');
    if (io) io.emit('staff_log_deleted', { id: log._id });

    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
