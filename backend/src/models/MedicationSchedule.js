const mongoose = require('mongoose');

// Standard, fixed dose times per frequency — a deliberately simple
// scheduling model (real hospital MAR systems vary this per drug/patient,
// but fixed slots per frequency is exactly how many small hospitals and
// ward whiteboards already do it, and keeps "what's due right now" a
// simple, predictable computation instead of a rules engine).
const FREQUENCY_TIMES = {
  once_daily:          ['09:00'],
  twice_daily:         ['09:00', '21:00'],
  three_times_daily:   ['08:00', '14:00', '20:00'],
  four_times_daily:    ['06:00', '12:00', '18:00', '00:00'],
  every_6_hours:       ['06:00', '12:00', '18:00', '00:00'],
  every_8_hours:       ['08:00', '16:00', '00:00'],
  every_12_hours:      ['09:00', '21:00'],
  as_needed:           [], // PRN — no fixed times, given only when the patient needs it
};

const MedicationScheduleSchema = new mongoose.Schema({
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineName: { type: String, required: true, trim: true },
  dosage:       { type: String, required: true, trim: true }, // e.g. "500mg", "2 tablets"
  route:        { type: String, enum: ['oral','iv','im','subcutaneous','topical','inhaled','other'], default: 'oral' },
  frequency:    { type: String, enum: Object.keys(FREQUENCY_TIMES), required: true },
  startDate:    { type: Date, required: true, default: Date.now },
  endDate:      { type: Date }, // optional — open-ended if not set
  notes:        { type: String, default: '' },
  prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // The nurse responsible for administering this — chosen by the doctor
  // from whoever is actually on shift right now, not just anyone with the
  // nurse role. Optional: if left blank, any on-duty nurse can pick it up
  // from the shared MAR list.
  assignedNurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active:       { type: Boolean, default: true },
  discontinuedAt: { type: Date },
  discontinuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

MedicationScheduleSchema.index({ patient: 1, active: 1 });

MedicationScheduleSchema.methods.getDoseTimesForToday = function() {
  return FREQUENCY_TIMES[this.frequency] || [];
};

module.exports = mongoose.model('MedicationSchedule', MedicationScheduleSchema);
module.exports.FREQUENCY_TIMES = FREQUENCY_TIMES;
