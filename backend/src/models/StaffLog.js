const mongoose = require('mongoose');

// A lightweight, self-service log staff can create themselves — distinct
// from the Task model (which is admin/doctor/nurse assigning work TO
// staff). This covers things like a wardboy logging a transport/supply
// request, or a security officer logging a patrol round or an incident.
// Kept generic via `category` + `type` so multiple roles can reuse it.
const StaffLogSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:        { type: String, required: true }, // snapshot of user's role at creation time
  category:    { type: String, enum: ['transport_request','supply_request','incident_report','patrol_log','maintenance_request','visitor_log','other'], required: true },
  title:       { type: String, required: true },
  details:     { type: String, default: '' },
  location:    { type: String, default: '' },
  priority:    { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
  status:      { type: String, enum: ['open','in_progress','resolved','closed'], default: 'open' },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt:  { type: Date, default: null },
  resolutionNotes: { type: String, default: '' },
  closedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt:    { type: Date, default: null },
}, { timestamps: true });

StaffLogSchema.index({ user: 1, createdAt: -1 });
StaffLogSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('StaffLog', StaffLogSchema);
