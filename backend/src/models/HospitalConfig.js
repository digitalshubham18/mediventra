const mongoose = require('mongoose');

// Singleton document (there is only ever one) — lets admin set the real
// hospital name and the actual signatory (name/title + an uploaded
// signature image) used on generated certificates, instead of hardcoding
// placeholder values.
const HospitalConfigSchema = new mongoose.Schema({
  hospitalName:   { type: String, default: 'Mediventra' },
  signatoryName:  { type: String, default: '' },
  signatoryTitle: { type: String, default: 'Chief Medical Officer' },
  signatureUrl:   { type: String, default: '' }, // uploaded signature image, transparent PNG recommended
  // Public-facing contact details shown on the marketing homepage —
  // admin-editable so the site never ships with a placeholder/fake number.
  contactPhone:   { type: String, default: '' },
  contactEmail:   { type: String, default: '' },
  address:        { type: String, default: '' },
  tagline:        { type: String, default: 'Compassionate Care, Modern Medicine' },
}, { timestamps: true });

module.exports = mongoose.model('HospitalConfig', HospitalConfigSchema);
