const AuditLog = require('../models/AuditLog');

// GET /api/audit-log — admin only
exports.getAuditLog = async (req, res) => {
  try {
    const q = {};
    if (req.query.action) q.action = req.query.action;
    if (req.query.actor)  q.actor  = req.query.actor;
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   q.createdAt.$lte = new Date(req.query.to);
    }
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await AuditLog.find(q).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
