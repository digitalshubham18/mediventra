const Notification = require('../models/Notification');

// GET /api/notifications?unread=true&limit=30
exports.getMine = async (req, res) => {
  try {
    const q = { user: req.user.id };
    if (req.query.unread === 'true') q.read = false;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const notifications = await Notification.find(q).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/notifications/unread-count — lightweight poll-friendly endpoint
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ success: true, unreadCount });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: true }, { new: true });
    if (!n) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: n });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked read' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/notifications/:id
exports.remove = async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!n) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
