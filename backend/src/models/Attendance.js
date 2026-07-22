const mongoose = require('mongoose');

// One record per staff member per calendar day. "Smart" pieces:
//  - status is computed automatically from the matching Schedule shift
//    (on time / late, with a configurable grace period) rather than
//    typed in by hand;
//  - check-in can optionally be geofenced to the hospital location, the
//    same pattern used for patient entry check-in;
//  - workedMinutes is derived from actual check-in/out timestamps, not
//    the scheduled shift length.
const AttendanceSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:       { type: Date, required: true }, // normalized to midnight, local day
  schedule:   { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', default: null },

  checkInTime:  { type: Date, default: null },
  checkOutTime: { type: Date, default: null },
  checkInMethod:  { type: String, enum: ['manual', 'geofence', 'face'], default: 'manual' },
  checkOutMethod: { type: String, enum: ['manual', 'geofence', 'face'], default: 'manual' },

  scheduledStart: { type: String, default: '' }, // "08:00" snapshot at check-in time, in case the shift changes later
  lateByMinutes:  { type: Number, default: 0 },
  workedMinutes:  { type: Number, default: null },

  status: { type: String, enum: ['present', 'late', 'half_day', 'on_leave', 'absent'], default: 'present' },
  // Set true when an admin approves a late-reporting request for this day —
  // the day still shows its history honestly, but is excluded from the
  // late-fine deduction and from "late" counts in reports.
  lateWaived: { type: Boolean, default: false },
  notes:  { type: String, default: '' },
}, { timestamps: true });

AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
