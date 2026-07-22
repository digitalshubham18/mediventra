const mongoose = require('mongoose');

const InsuranceClaimSchema = new mongoose.Schema({
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policy:      { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }, // optional — link to the visit this claim is for
  claimAmount: { type: Number, required: true }, // what the patient is claiming
  approvedAmount: { type: Number, default: null }, // what was actually approved, set on review
  reason:      { type: String, required: true, trim: true }, // diagnosis/treatment description
  documents:   { type: [String], default: [] }, // uploaded bill/prescription/report file URLs

  status: {
    type: String,
    enum: ['submitted','under_review','approved','rejected','paid'],
    default: 'submitted',
  },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String, default: '' },
  reviewedAt:  { type: Date },
  paidAt:      { type: Date },
}, { timestamps: true });

InsuranceClaimSchema.index({ patient: 1, createdAt: -1 });
InsuranceClaimSchema.index({ status: 1 });

module.exports = mongoose.model('InsuranceClaim', InsuranceClaimSchema);
