const mongoose = require('mongoose');

// Registry of Third Party Administrators / insurers the hospital deals
// with for cashless treatment, plus their negotiated package/procedure
// rates — so finance knows upfront what a given TPA will actually
// reimburse for a procedure rather than guessing at claim time.
const RateSchema = new mongoose.Schema({
  procedureName:   { type: String, required: true, trim: true },
  negotiatedRate:  { type: Number, required: true, min: 0 },
  notes:           { type: String, default: '' },
}, { _id: true });

const TPAProviderSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true }, // e.g. "Star Health", "MDIndia TPA"
  tpaCode:       { type: String, default: '' }, // internal/industry code, if any
  contactPerson: { type: String, default: '' },
  contactPhone:  { type: String, default: '' },
  contactEmail:  { type: String, default: '' },
  address:       { type: String, default: '' },
  rates:         { type: [RateSchema], default: [] },
  active:        { type: Boolean, default: true },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

TPAProviderSchema.index({ name: 1 });

module.exports = mongoose.model('TPAProvider', TPAProviderSchema);
