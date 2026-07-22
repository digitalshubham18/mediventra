const mongoose = require('mongoose');

// The room seed data already lists "Nurse Call System" as equipment in
// every ward — this is the feature that actually makes that real. Tied to
// an active Admission so a call always carries a real room/bed location.
const NurseCallSchema = new mongoose.Schema({
  patient:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admission:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', required: true },
  room:       { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', required: true },
  reason:     { type: String, default: '' }, // optional — "pain", "need water", "IV alarm", etc.
  status:     { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  resolvedAt:     { type: Date, default: null },
}, { timestamps: true });

NurseCallSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NurseCall', NurseCallSchema);
