const mongoose = require('mongoose');

// General hospital feedback — separate from per-appointment doctor Reviews.
// Lets a patient share feedback about the hospital experience overall
// (facilities, staff, cleanliness, etc.), not tied to a specific visit.
const FeedbackSchema = new mongoose.Schema({
  patient:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:  { type: String, enum: ['facility','staff','cleanliness','billing','wait_time','other'], default: 'other' },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  message:   { type: String, default: '', maxlength: 2000 },
  status:    { type: String, enum: ['new','reviewed','resolved'], default: 'new' },
  adminResponse: { type: String, default: '' },
  respondedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  respondedAt:   { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
