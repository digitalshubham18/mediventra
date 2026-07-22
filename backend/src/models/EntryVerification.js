const mongoose = require('mongoose');

// Tracks the physical hospital-entry workflow for a confirmed, paid
// appointment: patient arrives at reception with their OTP, receptionist
// verifies it, a room/bed is assigned, and the wardboy dashboard is
// notified with full patient + room details so the patient can be
// escorted to the right place.
const EntryVerificationSchema = new mongoose.Schema({
  appointment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  otp:          { type: String, required: true },        // 6-digit code, generated on payment confirmation
  otpExpiresAt: { type: Date, required: true },

  status:       { type: String, enum: ['awaiting_arrival', 'verified', 'expired', 'cancelled'], default: 'awaiting_arrival' },

  verifiedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // receptionist who checked them in
  verifiedAt:   { type: Date, default: null },

  room:         { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', default: null },
  roomAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  roomAssignedAt: { type: Date, default: null },

  // Receptionist's judgement call at check-in time: does this patient look
  // like they may need a bed (e.g. Emergency/Surgery Consult, visibly unwell)?
  // This does NOT assign a room by itself — it just flags the appointment
  // for the doctor to confirm or decline once they've actually examined the
  // patient. Most outpatient visits never need this at all.
  bedLikely:    { type: Boolean, default: false },

  wardboyNotified:   { type: Boolean, default: false },
  assignedWardboy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // specific wardboy picked by reception, if any
  wardboyAcknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  wardboyAcknowledgedAt: { type: Date, default: null },

  notes:        { type: String, default: '' },
}, { timestamps: true });

EntryVerificationSchema.index({ patient: 1, status: 1 });
EntryVerificationSchema.index({ otpExpiresAt: 1 });

module.exports = mongoose.model('EntryVerification', EntryVerificationSchema);
