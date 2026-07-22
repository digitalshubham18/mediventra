const mongoose = require('mongoose');

const MedicineLineSchema = new mongoose.Schema({
  medicine:     { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  name:         { type: String, required: true },
  dosage:       { type: String, default: '' },   // e.g. "1 tablet twice daily"
  duration:     { type: String, default: '' },   // e.g. "7 days"
  instructions: { type: String, default: '' },   // e.g. "after food"
}, { _id: false });

const PrescriptionSchema = new mongoose.Schema({
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  diagnosis:   { type: String, required: true },
  medicines:   { type: [MedicineLineSchema], default: [] },
  followUpDate:{ type: Date, default: null },
  notes:       { type: String, default: '' },
  status:      { type: String, enum: ['active', 'completed'], default: 'active' },
}, { timestamps: true });

PrescriptionSchema.index({ patient: 1, createdAt: -1 });
PrescriptionSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
