const mongoose = require('mongoose');

// A visual recovery/follow-up plan a doctor sets for a patient after a
// procedure or discharge — e.g. "Remove stitches — Day 7", "Follow-up
// scan — Day 30". The patient sees this as a timeline on their
// dashboard so they know what's next without having to ask.
const MilestoneSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  targetDate:  { type: Date, required: true },
  status:      { type: String, enum: ['upcoming', 'done', 'missed'], default: 'upcoming' },
  completedAt: { type: Date },
}, { _id: true });

const DischargePlanSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true, default: 'Recovery Plan' }, // e.g. "Post-Appendectomy Recovery"
  milestones: [MilestoneSchema],
  active:  { type: Boolean, default: true },
}, { timestamps: true });

DischargePlanSchema.index({ patient: 1, active: 1 });

module.exports = mongoose.model('DischargePlan', DischargePlanSchema);
