const mongoose = require('mongoose');

// Every socket alert in the system (task assigned, lab ready, vitals flagged,
// leave reviewed, etc.) used to only ever show as a toast that vanished the
// moment you missed it. This model gives every one of those a permanent home
// in a per-user inbox, so a person can see what they missed after the fact.
const NotificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, required: true }, // e.g. 'task_assigned', 'lab_ready', 'vitals_alert', 'leave_reviewed'
  title:   { type: String, required: true },
  message: { type: String, default: '' },
  link:    { type: String, default: '' }, // in-app route to navigate to on click, e.g. '/records'
  icon:    { type: String, default: '🔔' },
  read:    { type: Boolean, default: false, index: true },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

NotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
