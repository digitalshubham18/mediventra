const mongoose = require('mongoose');

const InsurancePolicySchema = new mongoose.Schema({
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider:     { type: String, required: true, trim: true }, // e.g. "Star Health", "HDFC ERGO"
  policyNumber: { type: String, required: true, trim: true },
  policyType:   { type: String, enum: ['individual','family','corporate','government'], default: 'individual' },
  sumInsured:   { type: Number, required: true },
  validFrom:    { type: Date, required: true },
  validTill:    { type: Date, required: true },
  cardImageUrl: { type: String, default: '' }, // photo of the physical/digital insurance card, if uploaded
  notes:        { type: String, default: '' },
}, { timestamps: true });

InsurancePolicySchema.index({ patient: 1 });

// A policy is only useful to reference for a claim while it's within its
// valid dates — computed on the fly rather than stored, so it's always
// accurate without needing a cron job to flip a stale "status" field.
InsurancePolicySchema.methods.isCurrentlyValid = function() {
  const now = new Date();
  return this.validFrom <= now && now <= this.validTill;
};

module.exports = mongoose.model('InsurancePolicy', InsurancePolicySchema);
