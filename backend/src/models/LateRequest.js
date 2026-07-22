const mongoose = require('mongoose');

// A staff member's appeal against a "late" mark on a specific day — e.g.
// traffic, a medical emergency, an approved late start. If admin approves,
// that day's attendance is corrected (no longer counted as late) and it's
// excluded from the late-fine deduction when salary is generated.
const LateRequestSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendance:  { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
  date:        { type: Date, required: true },
  reason:      { type: String, required: true, trim: true },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:  { type: Date, default: null },
  adminNote:   { type: String, default: '' },
}, { timestamps: true });

LateRequestSchema.index({ user: 1, attendance: 1 }, { unique: true });
LateRequestSchema.index({ status: 1 });

module.exports = mongoose.model('LateRequest', LateRequestSchema);
