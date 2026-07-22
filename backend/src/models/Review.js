const mongoose = require('mongoose');

// One review per appointment, submitted by the patient once a doctor marks
// it completed. This is what makes doctor ratings real instead of a static
// fabricated number — the average is computed live from these documents.
const ReviewSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  doctor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:      { type: Number, required: true, min: 1, max: 5 },
  comment:     { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });

ReviewSchema.index({ doctor: 1 });

module.exports = mongoose.model('Review', ReviewSchema);
