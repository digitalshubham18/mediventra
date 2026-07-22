const mongoose = require('mongoose');

// Ties a patient to a specific room/bed for their in-patient stay. This
// didn't exist anywhere before — OTRoom only tracked an aggregate
// occupied-bed count with no record of which patient was in which bed,
// and DischargePlan was just a milestone/recovery-plan tracker with no
// room or billing involved at all.
const AdmissionSchema = new mongoose.Schema({
  patient:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room:                { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', required: true },
  admittingDoctor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reasonForAdmission:  { type: String, required: true },
  admissionDate:       { type: Date, default: Date.now },
  expectedDischargeDate: { type: Date, default: null },
  dischargeDate:       { type: Date, default: null },
  status:              { type: String, enum: ['admitted', 'discharged'], default: 'admitted' },
  roomChargePerDay:    { type: Number, required: true }, // snapshotted from the room at admission time
  dischargeSummary:    { type: String, default: '' },
  // Consolidated final bill, filled in at discharge time
  bill: {
    roomCharges:      { type: Number, default: 0 },
    pharmacyCharges:  { type: Number, default: 0 },
    doctorFee:        { type: Number, default: 0 },
    otherCharges:     { type: Number, default: 0 },
    otherChargesNote: { type: String, default: '' },
    totalAmount:      { type: Number, default: 0 },
    paymentMode:      { type: String, default: '' },
    payment:          { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

AdmissionSchema.index({ patient: 1, status: 1 });
AdmissionSchema.index({ room: 1, status: 1 });

module.exports = mongoose.model('Admission', AdmissionSchema);
