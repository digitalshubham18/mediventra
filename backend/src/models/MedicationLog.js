const mongoose = require('mongoose');

const MedicationLogSchema = new mongoose.Schema({
  schedule:     { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationSchedule', required: true },
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledDate:{ type: String, required: true }, // "YYYY-MM-DD" — the calendar day this dose was due
  doseTime:     { type: String, required: true }, // "HH:MM" (24h) — which of the day's fixed slots this is, or "PRN" for as-needed doses
  status:       { type: String, enum: ['given','missed','refused'], required: true },
  administeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  administeredAt: { type: Date, default: Date.now },
  notes:        { type: String, default: '' },
}, { timestamps: true });

// One log entry per schedule+date+time slot — prevents accidentally
// double-logging the same dose twice.
MedicationLogSchema.index({ schedule: 1, scheduledDate: 1, doseTime: 1 }, { unique: true });
MedicationLogSchema.index({ patient: 1, scheduledDate: 1 });

module.exports = mongoose.model('MedicationLog', MedicationLogSchema);
