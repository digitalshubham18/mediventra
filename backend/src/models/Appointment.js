const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  // Short, human-readable reference shown to the patient ("APT-XXXXXX") —
  // generated once on creation via the pre-save hook below.
  appointmentNumber: { type: String, unique: true, sparse: true },
  patient:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: Date, required: [true, 'Appointment date is required'] },
  timeSlot:  { type: String, required: [true, 'Time slot is required'] },
  department:{ type: String, default: '' },
  type:      { type: String, enum: ['Consultation','Follow-up','Emergency','Surgery Consult','Checkup','X-Ray Review','consultation','follow_up','emergency','procedure'], default: 'Consultation' },
  status:    { type: String, enum: ['pending','confirmed','cancelled','completed','no_show'], default: 'pending' },
  reason:    { type: String, default: '' },
  notes:     { type: String, default: '' },
  doctorNotes: { type: String, default: '' },
  symptoms:  { type: [String], default: [] },
  cancelReason: { type: String, default: '' },
  fee:       { type: Number, default: 500 },
  // ── Doctor's post-visit consultation summary — required when an
  // appointment is marked completed, so the patient (and future visits)
  // always know what was prescribed/advised, not just a vague "Completed". ──
  consultation: {
    medicines:     { type: String, default: '' }, // what's required / was prescribed
    instructions:  { type: String, default: '' }, // what to do / not do
    completedAt:   { type: Date, default: null },
  },
  followUp: {
    required:  { type: Boolean, default: false },
    date:      { type: Date, default: null },
    notes:     { type: String, default: '' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null }, // the actual follow-up appointment created, if any
  },
  // ── Bed / admission workflow ───────────────────────────────────────────
  // Not every patient needs a bed, so this is opt-in and two-stage:
  // reception can *flag* a patient as a likely admission at check-in
  // (based on appointment type or how the patient looks), but nothing is
  // assigned until the DOCTOR confirms after actually examining them.
  // Only once confirmed does it show up in reception's actionable queue to
  // pick a room/bed and (optionally) a wardboy.
  admission: {
    status: { type: String, enum: ['none','flagged','confirmed','declined','assigned'], default: 'none' },
    flaggedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    flaggedAt:   { type: Date, default: null },
    flagNote:    { type: String, default: '' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // doctor
    confirmedAt: { type: Date, default: null },
    reason:      { type: String, default: '' },
    declinedAt:  { type: Date, default: null },
    admissionRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', default: null },
  },
  ratingSubmitted: { type: Boolean, default: false }, // denormalized flag so the patient UI can quickly know whether to show "Rate your visit"
  paid:      { type: Boolean, default: false },
  // String mirror of `paid` used by the frontend to show/hide "Pay Now" and
  // payment badges (pending/paid/refunded) — kept in sync wherever `paid`
  // is set so the button correctly disappears once payment succeeds.
  paymentStatus: { type: String, enum: ['pending','paid','refunded'], default: 'pending' },

  // ── Video Consultation ────────────────────────────────────────────────
  // consultMode chosen at booking time. videoRoomId is a private, unguessable
  // room name generated once so the WebRTC signaling relay (server.js) and
  // both participants' browsers can find each other for this appointment
  // only — nobody else can join since the id is never shown anywhere else.
  consultMode: { type: String, enum: ['in-person','video'], default: 'in-person' },
  videoRoomId: { type: String, default: '' },
  videoCallStartedAt: { type: Date },
  videoCallEndedAt:   { type: Date },
}, { timestamps: true });

AppointmentSchema.index({ patient: 1, date: -1 });
AppointmentSchema.index({ doctor: 1, date: 1 });
AppointmentSchema.index({ status: 1 });

AppointmentSchema.pre('save', function(next) {
  if (!this.appointmentNumber) {
    this.appointmentNumber = 'APT-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  if (this.consultMode === 'video' && !this.videoRoomId) {
    this.videoRoomId = 'vc-' + require('crypto').randomBytes(12).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
