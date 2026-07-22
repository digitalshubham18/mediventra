const mongoose = require('mongoose');

// Phone number changes are no longer self-verified via an SMS OTP — a user
// submits a request here, and an admin reviews it (approve/reject) before
// the phone number on the account actually changes. Keeps a full audit
// trail of who asked for what and who reviewed it.
const PhoneChangeRequestSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currentPhone:   { type: String, default: '' },
  requestedPhone: { type: String, required: true },
  reason:         { type: String, default: '' },
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:     { type: Date, default: null },
  adminNote:      { type: String, default: '' },
}, { timestamps: true });

PhoneChangeRequestSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('PhoneChangeRequest', PhoneChangeRequestSchema);
