const mongoose = require('mongoose');

// Stores which of a staff member's role-specific daily checklist items
// have been ticked off, scoped to a single calendar day. One document
// per user per day — `dateKey` is a YYYY-MM-DD string so it's trivial to
// query/upsert without timezone-range gymnastics.
const DailyChecklistSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dateKey: { type: String, required: true }, // 'YYYY-MM-DD' in server-local time
  // map of checklist item index -> completed boolean, e.g. { "0": true, "2": true }
  items:   { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

DailyChecklistSchema.index({ user: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyChecklist', DailyChecklistSchema);
