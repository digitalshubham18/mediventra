const mongoose = require('mongoose');

const RefillRequestSchema = new mongoose.Schema({
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  doctor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // copied from the prescription for easy "my requests to review" queries
  medicines:    { type: [String], default: [] }, // names of the specific medicines needing a refill
  reason:       { type: String, default: '' },
  status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNotes:  { type: String, default: '' },
  reviewedAt:   { type: Date, default: null },
}, { timestamps: true });

RefillRequestSchema.index({ patient: 1, createdAt: -1 });
RefillRequestSchema.index({ doctor: 1, status: 1 });

module.exports = mongoose.model('RefillRequest', RefillRequestSchema);
