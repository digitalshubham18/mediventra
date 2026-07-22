const mongoose = require('mongoose');

// Lightweight "what are they doing" trail. Populated automatically by the
// `protect` auth middleware for meaningful (non-polling) requests. Kept
// intentionally small per row — this is for an admin activity feed, not a
// full audit log.
const ActivityLogSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String, default: '' },
  method:   { type: String, default: 'GET' },
  path:     { type: String, default: '' },
  label:    { type: String, default: '' }, // human-readable description, e.g. "Viewed Patients list"
}, { timestamps: true });

ActivityLogSchema.index({ user: 1, createdAt: -1 });
// Auto-expire after 30 days so this never grows unbounded
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
