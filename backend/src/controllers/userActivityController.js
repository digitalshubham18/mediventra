const UserSession = require('../models/UserSession');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// GET /api/useractivity/me/today — any logged-in staff member can see their
// own time spent on the site today (login time, total duration). This is
// the self-service counterpart to the admin overview below.
exports.getMyToday = async (req, res) => {
  try {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const sessions = await UserSession.find({ user: req.user.id, loginAt: { $gte: startOfToday } }).sort({ loginAt: 1 });
    const closedSecs = sessions.filter(s => !s.active).reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const open = sessions.find(s => s.active);
    const liveSecs = open ? Math.round((Date.now() - new Date(open.loginAt).getTime()) / 1000) : 0;
    res.json({
      success: true,
      data: {
        timeSpentTodaySeconds: closedSecs + liveSecs,
        sessionsToday: sessions.length,
        firstLoginAt: sessions[0]?.loginAt || null,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/useractivity/me/sessions — your own login/logout history
exports.getMySessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({ user: req.user.id }).sort({ loginAt: -1 }).limit(40);
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/useractivity/me/activity — your own recent activity feed
exports.getMyActivity = async (req, res) => {
  try {
    const activity = await ActivityLog.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(60);
    res.json({ success: true, count: activity.length, data: activity });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/useractivity/overview — one row per user: today's time spent,
// last seen, last action, online status. Powers the admin "User Activity"
// dashboard list.
exports.getOverview = async (req, res) => {
  try {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const onlineMap = req.app.get('onlineUsers');

    const users = await User.find({}).select('name email role department avatar isOnline lastSeen');

    const [todaySessions, lastActivities, latestSessions] = await Promise.all([
      UserSession.find({ loginAt: { $gte: startOfToday } }),
      ActivityLog.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$user', label: { $first: '$label' }, createdAt: { $first: '$createdAt' } } },
      ]),
      UserSession.aggregate([
        { $sort: { loginAt: -1 } },
        { $group: { _id: '$user', ip: { $first: '$ip' }, location: { $first: '$location' }, loginAt: { $first: '$loginAt' } } },
      ]),
    ]);

    const lastActivityMap = new Map(lastActivities.map(a => [a._id.toString(), a]));
    const latestSessionMap = new Map(latestSessions.map(s => [s._id.toString(), s]));

    const data = users.map(u => {
      const uid = u._id.toString();
      const sessionsToday = todaySessions.filter(s => s.user.toString() === uid);
      const closedSecs = sessionsToday.filter(s => !s.active).reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      const openSession = sessionsToday.find(s => s.active);
      const liveSecs = openSession ? Math.round((Date.now() - new Date(openSession.loginAt).getTime()) / 1000) : 0;
      const lastAct = lastActivityMap.get(uid);
      const presence = onlineMap?.get(uid);
      const latestSession = latestSessionMap.get(uid);

      return {
        _id: u._id, name: u.name, email: u.email, role: u.role,
        department: u.department, avatar: u.avatar,
        isOnline: !!presence || u.isOnline,
        lastSeen: presence?.lastSeen || u.lastSeen,
        timeSpentTodaySeconds: closedSecs + liveSecs,
        sessionsToday: sessionsToday.length,
        lastActivity: lastAct ? { label: lastAct.label, at: lastAct.createdAt } : null,
        lastLogin: latestSession ? { ip: latestSession.ip, location: latestSession.location, at: latestSession.loginAt } : null,
      };
    });

    // Most recently active first
    data.sort((a, b) => (b.timeSpentTodaySeconds - a.timeSpentTodaySeconds));

    res.json({ success: true, count: data.length, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/useractivity/:userId/sessions — login/logout history for one user
exports.getUserSessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({ user: req.params.userId })
      .sort({ loginAt: -1 })
      .limit(60);
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/useractivity/:userId/activity — recent "what are they doing" feed for one user
exports.getUserActivity = async (req, res) => {
  try {
    const activity = await ActivityLog.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: activity.length, data: activity });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
