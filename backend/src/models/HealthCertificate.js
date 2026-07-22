const mongoose = require('mongoose');

const HealthCertificateSchema = new mongoose.Schema({
  patient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // not required for blood_donation certs, which are issued by whichever staff completed the donation
  type:     { type: String, enum: ['fitness', 'medical_leave', 'general', 'blood_group', 'blood_donation'], required: true },
  purpose:  { type: String, required: true }, // e.g. "For gym membership", "For school absence"
  diagnosis: { type: String, default: '' },
  findings:  { type: String, default: '' }, // clinical findings supporting a fitness certificate
  restAdvice: { type: String, default: '' },
  bloodGroup: { type: String, default: '' }, // populated for blood_group and blood_donation certificates
  // Links back to the BloodDonation record so the UI can fetch/download the
  // actual generated PDF instead of rendering a generic certificate view.
  donationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodDonation', default: null },
  // Medical leave certificates need a date range; fitness/general certs
  // are usually a point-in-time statement, so these are optional.
  leaveFrom: { type: Date, default: null },
  leaveTo:   { type: Date, default: null },
  certificateNumber: { type: String, unique: true },
  issuedDate: { type: Date, default: Date.now },
}, { timestamps: true });

HealthCertificateSchema.index({ patient: 1, createdAt: -1 });
HealthCertificateSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('HealthCertificate', HealthCertificateSchema);
