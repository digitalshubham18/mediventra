const mongoose = require('mongoose');

// A lightweight, append-only trail of consequential actions across the
// hospital system — who did what, to what, and when. Real HMS deployments
// need this for accountability (e.g. "who deleted this lab report?",
// "who reassigned this room?") separate from any one feature's own
// notification logic.
const AuditLogSchema = new mongoose.Schema({
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },

  action: {
    type: String,
    required: true,
    enum: [
      'record_deleted', 'record_created', 'record_updated',
      'room_assigned', 'room_updated', 'room_deleted',
      'user_approved', 'user_deleted', 'user_role_changed',
      'patient_created_by_staff',
      'email_changed', 'password_changed',
      'bug_report_status_changed',
    ],
  },

  // Free-form summary shown directly in the audit log UI, e.g.
  // "Deleted lab report for Priya Sharma" — built by the caller so the
  // log reads naturally without the UI needing to know every action's
  // shape.
  description: { type: String, required: true },

  // Loosely-typed extra context for filtering/debugging — kept separate
  // from `description` so the human-readable summary never has to be
  // parsed back apart.
  targetType: { type: String, default: '' }, // e.g. 'HealthRecord', 'OTRoom', 'User'
  targetId:   { type: mongoose.Schema.Types.ObjectId },
  meta:       { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
