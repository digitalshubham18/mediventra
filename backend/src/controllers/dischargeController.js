const DischargePlan = require('../models/DischargePlan');

// GET /api/discharge-plans/mine — patient's own active recovery plan(s)
exports.getMine = async (req, res) => {
  try {
    const plans = await DischargePlan.find({ patient: req.user.id }).populate('doctor', 'name specialization').sort({ createdAt: -1 });
    res.json({ success: true, data: plans });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/discharge-plans/patient/:patientId — doctor viewing a specific patient's plan
exports.getForPatient = async (req, res) => {
  try {
    const plans = await DischargePlan.find({ patient: req.params.patientId }).populate('doctor', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: plans });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/discharge-plans — doctor creates a recovery plan for a patient
exports.create = async (req, res) => {
  try {
    const { patientId, title, milestones } = req.body;
    if (!patientId || !milestones?.length) return res.status(400).json({ success: false, error: 'patientId and at least one milestone are required' });
    const plan = await DischargePlan.create({
      patient: patientId, doctor: req.user.id, title: title || 'Recovery Plan',
      milestones: milestones.map(m => ({ title: m.title, description: m.description || '', targetDate: m.targetDate })),
    });
    res.status(201).json({ success: true, data: plan });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/discharge-plans/:id/milestones/:milestoneId — mark a milestone done (patient or doctor)
exports.updateMilestone = async (req, res) => {
  try {
    const plan = await DischargePlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
    const milestone = plan.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ success: false, error: 'Milestone not found' });
    milestone.status = req.body.status || milestone.status;
    if (milestone.status === 'done') milestone.completedAt = new Date();
    await plan.save();
    res.json({ success: true, data: plan });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
