const mongoose = require('mongoose');

// Predefined price bundles (e.g. "Normal Delivery Package", "Cataract
// Surgery Package") so front-desk/finance don't have to itemize every
// consumable for common procedures — one line, one price, one GST rate.
const BillingPackageSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  category:    { type: String, default: '' }, // e.g. "Maternity", "Surgery", "Diagnostics"
  description: { type: String, default: '' },
  includedItems: { type: [String], default: [] }, // human-readable list shown to patient, e.g. "3 days ICU", "Surgeon fee"
  price:       { type: Number, required: true, min: 0 },
  gstRate:     { type: Number, enum: [0, 5, 12, 18, 28], default: 0 },
  active:      { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('BillingPackage', BillingPackageSchema);
