const mongoose = require('mongoose');

// A doctor's OPD cabin/seating area — shown to a patient right after they
// book an appointment ("where to meet"), and visible to admin for the
// whole hospital's seating layout.
const DoctorCabinSchema = new mongoose.Schema({
  doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cabinNo:   { type: String, required: true },   // e.g. "OPD-12"
  floor:     { type: Number, default: 1 },
  building:  { type: String, default: 'Main Block' },
  wing:      { type: String, default: '' },       // e.g. "East Wing"
  notes:     { type: String, default: '' },       // e.g. "Next to Pharmacy"
}, { timestamps: true });

module.exports = mongoose.model('DoctorCabin', DoctorCabinSchema);
