const mongoose = require('mongoose');

// Used when a patient registers someone else (a relative/colleague) as the
// actual donor. We have no hospital records for this person, so instead of
// a records-based eligibility check they must explicitly confirm a basic
// self-declared checklist, and provide enough identifying detail that the
// certificate can correctly be issued in *their* name, not the requester's.
const RelativeDonorSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  age:         { type: Number, required: true },
  gender:      { type: String, default: '' },
  relation:    { type: String, required: true, trim: true }, // e.g. "Brother", "Colleague"
  phone:       { type: String, required: true, trim: true },
  bloodGroup:  { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'], required: true },
  address:     { type: String, default: '' },
  idProofType: { type: String, enum: ['aadhaar','pan','passport','voter_id','driving_license',''], default: '' },
  idProofNumber:{ type: String, default: '' },
}, { _id: false });

// Self-declared checklist collected when donorType is 'other', since there
// is no hospital record trail to check automatically for that person.
const SelfDeclarationSchema = new mongoose.Schema({
  ageConfirmed:     { type: Boolean, default: false }, // 18–65
  weightAbove45:    { type: Boolean, default: false },
  noRecentIllness:  { type: Boolean, default: false }, // no fever/infection in last 14 days
  noChronicDisease: { type: Boolean, default: false }, // no HIV/Hepatitis/cancer/heart/kidney disease etc.
  noRecentDonation: { type: Boolean, default: false }, // no donation in last 90 days
}, { _id: false });

// Snapshot of the records-based eligibility check at the moment the
// request was submitted (for donorType 'self') — kept for audit so staff
// reviewing the request can see exactly what was flagged, without
// re-deriving it later from records that may since have changed.
const EligibilitySnapshotSchema = new mongoose.Schema({
  eligible:   { type: Boolean, default: true },
  reasons:    { type: [String], default: [] },
  warnings:   { type: [String], default: [] },
  checkedAt:  { type: Date, default: Date.now },
}, { _id: false });

const BloodDonationSchema = new mongoose.Schema({
  // The account that submitted the request. For donorType 'self' this is
  // also the person donating; for donorType 'other' this is the
  // relative/colleague registering someone else, and the actual donor's
  // details live in `relative` below.
  donor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donorType:  { type: String, enum: ['self','other'], default: 'self' },
  relative:   { type: RelativeDonorSchema, default: undefined },
  selfDeclaration: { type: SelfDeclarationSchema, default: undefined },
  eligibility: { type: EligibilitySnapshotSchema, default: undefined },

  bloodGroup: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'], required: true },
  preferredDate: { type: Date, required: true },
  contactPhone:  { type: String, default: '' },
  notes:         { type: String, default: '' },

  status: {
    type: String,
    enum: ['requested', 'scheduled', 'completed', 'cancelled', 'rejected'],
    default: 'requested',
  },
  // Exact date + time staff scheduled the donation for — shown to the
  // patient and sent as a notification the moment it's set.
  scheduledDate: { type: Date },
  scheduledBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  unitsCollected: { type: Number, default: 1, min: 1, max: 2 },

  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // staff who recorded the donation
  rejectionReason: { type: String, default: '' },

  // Certificate — generated once, on completion. certificateNo doubles as
  // a human-checkable reference printed on the certificate itself.
  certificateNo:  { type: String, default: '' },
  certificateGeneratedAt: { type: Date },
}, { timestamps: true });

// Convenience — the name that should actually appear on the certificate
// and in any donor-facing display, regardless of who submitted the request.
BloodDonationSchema.methods.getDonorDisplayName = function(populatedDonorName) {
  if (this.donorType === 'other' && this.relative?.name) return this.relative.name;
  return populatedDonorName;
};

BloodDonationSchema.index({ donor: 1, createdAt: -1 });
BloodDonationSchema.index({ status: 1 });

module.exports = mongoose.model('BloodDonation', BloodDonationSchema);
