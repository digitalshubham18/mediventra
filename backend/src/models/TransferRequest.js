const mongoose = require('mongoose');

const TransferRequestSchema = new mongoose.Schema({
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName:  { type: String, default: '' }, // denormalized so wardboys see it without an extra populate
  fromLocation: { type: String, required: true, trim: true }, // e.g. "Emergency Ward, Bed 4"
  toLocation:   { type: String, required: true, trim: true }, // e.g. "ICU, Bed 2"
  reason:       { type: String, default: '' },
  priority:     { type: String, enum: ['routine','urgent'], default: 'routine' },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // doctor/nurse/receptionist/admin
  wardboy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // unassigned until accepted
  status: {
    type: String,
    enum: ['requested','assigned','in_transit','completed','cancelled'],
    default: 'requested',
  },
  assignedAt:   { type: Date },
  inTransitAt:  { type: Date },
  completedAt:  { type: Date },
  notes:        { type: String, default: '' },
}, { timestamps: true });

TransferRequestSchema.index({ status: 1, createdAt: -1 });
TransferRequestSchema.index({ wardboy: 1, status: 1 });

module.exports = mongoose.model('TransferRequest', TransferRequestSchema);
