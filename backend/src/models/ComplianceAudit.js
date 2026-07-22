const mongoose = require('mongoose');

// One audit round — a quality/accreditation team member walks through the
// active ComplianceStandard checklist on a given date and marks each item
// compliant / non-compliant / not-applicable, with evidence notes. This IS
// the "auto-documentation" — the audit record itself becomes the
// compliance paper trail, timestamped and attributed automatically rather
// than filled out on paper afterward.
const AuditItemSchema = new mongoose.Schema({
  standard: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceStandard', required: true },
  status:   { type: String, enum: ['compliant','non_compliant','not_applicable','pending'], default: 'pending' },
  evidence: { type: String, default: '' },
  correctiveAction: { type: String, default: '' },
}, { _id: false });

const ComplianceAuditSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true },
  department: { type: String, default: '' },
  auditDate:  { type: Date, required: true },
  auditedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:      { type: [AuditItemSchema], default: [] },
  status:     { type: String, enum: ['draft','completed'], default: 'draft' },
  overallScore: { type: Number, default: null }, // % compliant among applicable items, computed on completion
  notes:      { type: String, default: '' },
}, { timestamps: true });

ComplianceAuditSchema.index({ auditDate: -1 });
ComplianceAuditSchema.index({ status: 1 });

module.exports = mongoose.model('ComplianceAudit', ComplianceAuditSchema);
