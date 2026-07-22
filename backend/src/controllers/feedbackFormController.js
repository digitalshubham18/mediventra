const FeedbackForm = require('../models/FeedbackForm');
const FeedbackFormResponse = require('../models/FeedbackFormResponse');
const { logAction } = require('../utils/auditLog');

// ── Admin: manage forms ──────────────────────────────────────────────

// GET /api/feedback-forms — admin sees all forms they've created
exports.getAllForms = async (req, res) => {
  try {
    const forms = await FeedbackForm.find().sort({ createdAt: -1 });
    // Attach response counts so the admin can see engagement at a glance
    const withCounts = await Promise.all(forms.map(async f => {
      const count = await FeedbackFormResponse.countDocuments({ form: f._id });
      return { ...f.toObject(), responseCount: count };
    }));
    res.json({ success: true, data: withCounts });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/feedback-forms
exports.createForm = async (req, res) => {
  try {
    const { title, description, questions, targetRoles } = req.body;
    if (!title || !questions?.length) return res.status(400).json({ success: false, error: 'A title and at least one question are required' });
    if (!targetRoles?.length) return res.status(400).json({ success: false, error: 'Select at least one dashboard/role to send this to' });

    const form = await FeedbackForm.create({
      title, description: description || '', createdBy: req.user.id,
      questions: questions.map(q => ({ type: q.type, label: q.label, required: q.required !== false })),
      targetRoles,
    });

    // Notify everyone on the targeted dashboards right away
    const io = req.app.get('io');
    if (io) targetRoles.forEach(role => io.emit(`feedback_form_new_${role}`, { formId: form._id, title: form.title }));

    logAction({
      actor: req.user, action: 'record_created',
      description: `Created feedback form "${title}" for: ${targetRoles.join(', ')}`,
      targetType: 'FeedbackForm', targetId: form._id,
    });

    res.status(201).json({ success: true, data: form });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/feedback-forms/:id — edit or toggle active
exports.updateForm = async (req, res) => {
  try {
    const { title, description, questions, targetRoles, active } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (questions !== undefined) update.questions = questions;
    if (targetRoles !== undefined) update.targetRoles = targetRoles;
    if (active !== undefined) update.active = active;
    const form = await FeedbackForm.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
    res.json({ success: true, data: form });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.deleteForm = async (req, res) => {
  try {
    await FeedbackForm.findByIdAndDelete(req.params.id);
    await FeedbackFormResponse.deleteMany({ form: req.params.id });
    res.json({ success: true, message: 'Form and its responses deleted' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/feedback-forms/:id/results — aggregated results for one form
exports.getResults = async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
    const responses = await FeedbackFormResponse.find({ form: form._id }).populate('respondent', 'name').sort({ createdAt: -1 });

    const questionResults = form.questions.map(q => {
      // Pair each answer with its respondent directly, rather than
      // trying to look the respondent back up afterwards.
      const paired = responses
        .map(r => ({ answer: r.answers.find(a => String(a.questionId) === String(q._id)), respondentName: r.respondent?.name }))
        .filter(p => p.answer);

      if (q.type === 'rating') {
        const values = paired.map(p => Number(p.answer.value)).filter(v => !isNaN(v));
        const avg = values.length ? Math.round((values.reduce((s,v)=>s+v,0) / values.length) * 10) / 10 : null;
        const distribution = [1,2,3,4,5].map(star => values.filter(v => v === star).length);
        return { questionId: q._id, label: q.label, type: q.type, average: avg, responseCount: values.length, distribution };
      }
      // text/suggestion — collect the raw responses for the admin to read
      return {
        questionId: q._id, label: q.label, type: q.type, responseCount: paired.length,
        responses: paired.map(p => ({ text: p.answer.value, respondentName: p.respondentName })),
      };
    });

    res.json({ success: true, data: { form, totalResponses: responses.length, questionResults } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Non-admin: see + answer forms targeted at my role ────────────────

// GET /api/feedback-forms/mine — active forms for my role I haven't answered yet
exports.getMyPendingForms = async (req, res) => {
  try {
    const forms = await FeedbackForm.find({ active: true, targetRoles: req.user.role });
    const answered = await FeedbackFormResponse.find({ respondent: req.user.id }).select('form');
    const answeredIds = new Set(answered.map(a => String(a.form)));
    const pending = forms.filter(f => !answeredIds.has(String(f._id)));
    res.json({ success: true, data: pending });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/feedback-forms/:id/respond
exports.submitResponse = async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form || !form.active) return res.status(404).json({ success: false, error: 'This form is no longer accepting responses' });
    if (!form.targetRoles.includes(req.user.role)) return res.status(403).json({ success: false, error: 'This form isn\u2019t for your role' });

    const { answers } = req.body; // [{ questionId, value }]
    if (!answers?.length) return res.status(400).json({ success: false, error: 'Please answer at least one question' });

    const builtAnswers = answers.map(a => {
      const q = form.questions.id(a.questionId);
      if (!q) return null;
      return { questionId: q._id, type: q.type, label: q.label, value: a.value };
    }).filter(Boolean);

    const response = await FeedbackFormResponse.create({
      form: form._id, respondent: req.user.id, respondentRole: req.user.role, answers: builtAnswers,
    });

    res.status(201).json({ success: true, data: response, message: 'Thanks for your feedback!' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, error: 'You\u2019ve already responded to this form' });
    res.status(500).json({ success: false, error: e.message });
  }
};
