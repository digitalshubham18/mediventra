const Feedback = require('../models/Feedback');

// POST /api/feedback — patient submits general hospital feedback
exports.createFeedback = async (req, res) => {
  try {
    const { category, rating, message } = req.body;
    if (!rating) return res.status(400).json({ success: false, error: 'Rating is required' });
    const feedback = await Feedback.create({ patient: req.user.id, category: category || 'other', rating, message: (message||'').slice(0,2000) });
    const io = req.app.get('io');
    if (io) io.emit('new_feedback', { id: feedback._id, rating, category: feedback.category });
    res.status(201).json({ success: true, data: feedback, message: 'Thank you for your feedback!' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/feedback/mine — patient sees their own past feedback
exports.getMyFeedback = async (req, res) => {
  try {
    const data = await Feedback.find({ patient: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/feedback — admin sees all feedback
exports.getAllFeedback = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.category) q.category = req.query.category;
    const data = await Feedback.find(q).populate('patient','name email').populate('respondedBy','name').sort({ createdAt: -1 });
    const avg = data.length ? Math.round((data.reduce((s,f)=>s+f.rating,0)/data.length) * 10) / 10 : null;
    res.json({ success: true, count: data.length, average: avg, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/feedback/:id — admin responds to / resolves feedback
exports.respondToFeedback = async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, {
      status: status || 'reviewed',
      adminResponse: adminResponse || '',
      respondedBy: req.user.id,
      respondedAt: new Date(),
    }, { new: true }).populate('patient','name email');
    if (!feedback) return res.status(404).json({ success: false, error: 'Feedback not found' });
    res.json({ success: true, data: feedback });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
