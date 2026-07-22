const mongoose = require('mongoose');

const QueueTokenSchema = new mongoose.Schema({
  tokenNumber:  { type: Number, required: true }, // resets daily, per department (see controller)
  department:   { type: String, required: true },
  patientName:  { type: String, required: true, trim: true },
  phone:        { type: String, default: '' },
  purpose:      { type: String, default: '' },
  doctor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional preference, not a hard assignment
  // Set when the token belongs to a logged-in patient account — either
  // because they self-registered for a token, or reception linked their
  // walk-in to their existing profile. Optional: plenty of walk-ins are
  // one-off visitors with no account at all.
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: {
    type: String,
    enum: ['waiting','called','in_consultation','completed','no_show','cancelled'],
    default: 'waiting',
  },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // receptionist who registered them
  calledAt:     { type: Date },
  startedAt:    { type: Date },
  completedAt:  { type: Date },
  date:         { type: String, required: true }, // "YYYY-MM-DD" — the day this token belongs to
}, { timestamps: true });

QueueTokenSchema.index({ date: 1, department: 1, tokenNumber: 1 });
QueueTokenSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('QueueToken', QueueTokenSchema);
