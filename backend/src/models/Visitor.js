const mongoose = require('mongoose');

// Proper gate-pass style visitor register kept by SECURITY at the gate —
// distinct from the informal "visitor_log" staff-log entries reception
// could leave before; this has real fields (ID proof, vehicle, badge
// number, checkout) and its own dashboard section for the security team.
const VisitorSchema = new mongoose.Schema({
  visitorName: { type: String, required: true, trim: true },
  phone:       { type: String, default: '' },
  purpose:     { type: String, required: true, trim: true }, // e.g. "Meeting patient", "Vendor delivery", "Contractor visit"
  personToMeet:{ type: String, default: '' }, // free-text name (staff or patient) they're visiting
  patientToVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // linked if visiting an admitted/OPD patient
  department:  { type: String, default: '' },

  idProofType:   { type: String, enum: ['Aadhaar','PAN','Driving License','Passport','Voter ID','Other',''], default: '' },
  idProofNumber: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  badgeNumber:   { type: String, default: '' }, // physical gate-pass badge handed out, if used

  entryTime: { type: Date, default: Date.now },
  exitTime:  { type: Date, default: null },
  status:    { type: String, enum: ['checked_in','checked_out'], default: 'checked_in' },

  loggedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // security guard who logged entry
  checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:     { type: String, default: '' },
}, { timestamps: true });

VisitorSchema.index({ status: 1, entryTime: -1 });

module.exports = mongoose.model('Visitor', VisitorSchema);
