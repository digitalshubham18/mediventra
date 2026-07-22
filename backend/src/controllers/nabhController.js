const ComplianceStandard = require('../models/ComplianceStandard');
const ComplianceAudit = require('../models/ComplianceAudit');
const User = require('../models/User');
const Review = require('../models/Review');
const Attendance = require('../models/Attendance');

// ── STANDARDS (checklist master) ────────────────────────────────────────

exports.createStandard = async (req, res) => {
  try {
    const { code, category, description } = req.body;
    if (!code?.trim() || !description?.trim()) return res.status(400).json({ success: false, error: 'Code and description are required' });
    const standard = await ComplianceStandard.create({ code: code.trim(), category, description: description.trim(), createdBy: req.user.id });
    res.status(201).json({ success: true, data: standard });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getStandards = async (req, res) => {
  try {
    const q = req.query.all ? {} : { active: true };
    if (req.query.category) q.category = req.query.category;
    const standards = await ComplianceStandard.find(q).sort({ category: 1, code: 1 });
    res.json({ success: true, data: standards });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updateStandard = async (req, res) => {
  try {
    const standard = await ComplianceStandard.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!standard) return res.status(404).json({ success: false, error: 'Standard not found' });
    res.json({ success: true, data: standard });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deactivateStandard = async (req, res) => {
  try {
    const standard = await ComplianceStandard.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!standard) return res.status(404).json({ success: false, error: 'Standard not found' });
    res.json({ success: true, message: 'Standard deactivated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── AUDITS ────────────────────────────────────────────────────────────

// POST /api/nabh/audits — start a new audit round, pre-populated with every active standard
exports.createAudit = async (req, res) => {
  try {
    const { title, department, auditDate } = req.body;
    if (!title?.trim() || !auditDate) return res.status(400).json({ success: false, error: 'Title and audit date are required' });
    const standards = await ComplianceStandard.find({ active: true });
    if (standards.length === 0) return res.status(400).json({ success: false, error: 'No active standards to audit against — add some standards first' });

    const audit = await ComplianceAudit.create({
      title: title.trim(), department: department?.trim() || '', auditDate: new Date(auditDate), auditedBy: req.user.id,
      items: standards.map(s => ({ standard: s._id, status: 'pending' })),
    });
    await audit.populate(['items.standard', { path: 'auditedBy', select: 'name' }]);
    res.status(201).json({ success: true, data: audit });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getAudits = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const audits = await ComplianceAudit.find(q).populate('auditedBy', 'name').sort({ auditDate: -1 });
    res.json({ success: true, count: audits.length, data: audits });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getAudit = async (req, res) => {
  try {
    const audit = await ComplianceAudit.findById(req.params.id).populate('items.standard').populate('auditedBy', 'name');
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    res.json({ success: true, data: audit });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/nabh/audits/:id/item — update one checklist item's status/evidence
exports.updateAuditItem = async (req, res) => {
  try {
    const { standardId, status, evidence, correctiveAction } = req.body;
    const audit = await ComplianceAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    if (audit.status === 'completed') return res.status(400).json({ success: false, error: 'This audit is already completed and locked' });

    const item = audit.items.find(i => String(i.standard) === String(standardId));
    if (!item) return res.status(404).json({ success: false, error: 'Standard not found on this audit' });
    if (status) item.status = status;
    if (evidence !== undefined) item.evidence = evidence;
    if (correctiveAction !== undefined) item.correctiveAction = correctiveAction;
    await audit.save();
    await audit.populate('items.standard');
    res.json({ success: true, data: audit });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/nabh/audits/:id/complete — lock the audit and compute the score
exports.completeAudit = async (req, res) => {
  try {
    const audit = await ComplianceAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    if (audit.status === 'completed') return res.status(400).json({ success: false, error: 'Already completed' });

    const pending = audit.items.filter(i => i.status === 'pending');
    if (pending.length > 0) {
      return res.status(400).json({ success: false, error: `${pending.length} checklist item(s) still need a status before this audit can be completed` });
    }

    const applicable = audit.items.filter(i => i.status !== 'not_applicable');
    const compliant = applicable.filter(i => i.status === 'compliant');
    audit.overallScore = applicable.length > 0 ? Math.round((compliant.length / applicable.length) * 100) : null;
    audit.status = 'completed';
    await audit.save();
    await audit.populate(['items.standard', { path: 'auditedBy', select: 'name' }]);

    res.json({ success: true, data: audit });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/nabh/quality-indicators — real, cross-module quality metrics
exports.getQualityIndicators = async (req, res) => {
  try {
    const [reviewAgg, staffTotal, staffDocsComplete, completedAudits, last30dAttendance] = await Promise.all([
      Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      User.countDocuments({ role: { $ne: 'patient' }, status: 'approved' }),
      User.countDocuments({ role: { $ne: 'patient' }, status: 'approved', documentationStatus: 'complete' }),
      ComplianceAudit.find({ status: 'completed' }).sort({ auditDate: -1 }).limit(6).select('title auditDate overallScore'),
      Attendance.find({ date: { $gte: new Date(Date.now() - 30*24*60*60*1000) } }).select('status'),
    ]);

    const patientSatisfaction = reviewAgg[0]?.count > 0 ? Math.round((reviewAgg[0].avg / 5) * 100) : null;
    const staffDocCompliance = staffTotal > 0 ? Math.round((staffDocsComplete / staffTotal) * 100) : null;
    const punctualityRate = last30dAttendance.length > 0
      ? Math.round((last30dAttendance.filter(a => ['present'].includes(a.status)).length / last30dAttendance.length) * 100)
      : null;
    const avgAuditScore = completedAudits.length > 0
      ? Math.round(completedAudits.reduce((s, a) => s + (a.overallScore || 0), 0) / completedAudits.length)
      : null;

    res.json({
      success: true,
      data: {
        patientSatisfaction, reviewCount: reviewAgg[0]?.count || 0,
        staffDocCompliance, staffTotal,
        punctualityRate, attendanceRecordsCounted: last30dAttendance.length,
        avgAuditScore, recentAudits: completedAudits,
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
