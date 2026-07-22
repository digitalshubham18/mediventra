const mongoose = require('mongoose');

// A cashless pre-authorization request — hospital staff submit an
// estimated treatment cost to the patient's TPA/insurer BEFORE treatment
// (or at admission), and record the TPA's decision here. This is a
// distinct workflow from InsuranceClaim, which is a post-treatment
// reimbursement claim; pre-auth exists so cost is agreed upfront and the
// patient isn't billed for the covered portion at all.
const PreAuthRequestSchema = new mongoose.Schema({
  preAuthNumber: { type: String, unique: true, sparse: true },
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policy:       { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
  tpaProvider:  { type: mongoose.Schema.Types.ObjectId, ref: 'TPAProvider', default: null },
  admission:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', default: null },
  appointment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

  diagnosis:      { type: String, required: true, trim: true },
  treatmentPlan:  { type: String, default: '' },
  estimatedAmount:{ type: Number, required: true, min: 0 },
  documents:      { type: [String], default: [] },

  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tpaReferenceNumber: { type: String, default: '' }, // the TPA's own reference, once they respond

  status: { type: String, enum: ['submitted','query_raised','approved','partially_approved','rejected','expired'], default: 'submitted' },
  approvedAmount: { type: Number, default: null },
  queryNote:      { type: String, default: '' }, // what the TPA is asking for, if status is query_raised
  rejectionReason:{ type: String, default: '' },
  validTill:      { type: Date, default: null }, // pre-auths are usually time-boxed once approved

  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  respondedAt: { type: Date, default: null },
  notes:       { type: String, default: '' },
}, { timestamps: true });

PreAuthRequestSchema.index({ patient: 1, createdAt: -1 });
PreAuthRequestSchema.index({ status: 1 });

PreAuthRequestSchema.pre('save', function(next) {
  if (!this.preAuthNumber) {
    this.preAuthNumber = 'PA-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  next();
});

module.exports = mongoose.model('PreAuthRequest', PreAuthRequestSchema);
