const mongoose = require('mongoose');

// Stores one enrolled face descriptor per staff member — a 128-length
// float vector produced by face-api.js's face recognition model, NOT a
// photo. Used purely to verify "is the person clocking in actually the
// account holder", not for open-set identification/surveillance.
const FaceProfileSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  descriptor:  { type: [Number], required: true, validate: v => Array.isArray(v) && v.length === 128 },
  enrolledAt:  { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('FaceProfile', FaceProfileSchema);
