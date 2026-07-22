const mongoose = require('mongoose');

// When every slot for a doctor on a given day is taken, a patient can join
// this waitlist instead of just giving up. If someone else later cancels
// their appointment with that doctor on that day, everyone waiting gets
// notified that a slot just opened up.
const AppointmentWaitlistSchema = new mongoose.Schema({
  patient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:     { type: Date, required: true }, // the specific day they want
  notes:    { type: String, default: '' },
  status:   { type: String, enum: ['waiting', 'notified', 'booked', 'expired', 'cancelled'], default: 'waiting' },
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });

AppointmentWaitlistSchema.index({ doctor: 1, date: 1, status: 1 });
AppointmentWaitlistSchema.index({ patient: 1, status: 1 });

module.exports = mongoose.model('AppointmentWaitlist', AppointmentWaitlistSchema);
