const mongoose = require('mongoose');

// Master list of accreditation standards/checklist items the hospital
// tracks compliance against (NABH-style categories). Admin/quality team
// manage this list; ComplianceAudit rounds evaluate each one.
const ComplianceStandardSchema = new mongoose.Schema({
  code:        { type: String, required: true, trim: true }, // e.g. "PSQ-1.1"
  category: {
    type: String,
    enum: ['Patient Safety','Infection Control','Medication Management','Facility & Equipment','HR & Training','Patient Rights','Documentation & Records','Other'],
    default: 'Other',
  },
  description: { type: String, required: true, trim: true },
  active:      { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

ComplianceStandardSchema.index({ category: 1 });

module.exports = mongoose.model('ComplianceStandard', ComplianceStandardSchema);
