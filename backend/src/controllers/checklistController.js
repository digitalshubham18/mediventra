const DailyChecklist = require('../models/DailyChecklist');

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// GET /api/checklist/today — returns { dateKey, items } for the logged-in user
exports.getToday = async (req, res) => {
  try {
    const dateKey = todayKey();
    const doc = await DailyChecklist.findOne({ user: req.user.id, dateKey });
    res.json({ success: true, data: { dateKey, items: doc?.items || {} } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/checklist/today — body: { index, done }  (toggle one item)
exports.toggleItem = async (req, res) => {
  try {
    const { index, done } = req.body;
    if (index === undefined) return res.status(400).json({ success: false, error: 'index is required' });
    const dateKey = todayKey();
    const doc = await DailyChecklist.findOneAndUpdate(
      { user: req.user.id, dateKey },
      { $set: { [`items.${index}`]: !!done } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: { dateKey, items: doc.items } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
