const mongoose = require('mongoose');

// A department's requisition ("indent") to the central store for supplies.
// Two-step workflow mirrors how real hospital stores operate: the store
// keeper first APPROVES (or rejects/partially approves) a request based on
// what's justified, then separately FULFILLS it (physically hands over /
// dispatches stock) once approved — approval and stock deduction are not
// the same moment.
const IndentItemSchema = new mongoose.Schema({
  item:              { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  approvedQuantity:  { type: Number, default: null },
}, { _id: false });

const IndentSchema = new mongoose.Schema({
  indentNumber: { type: String, unique: true, sparse: true },
  department:   { type: String, required: true }, // requesting ward/department name
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:        { type: [IndentItemSchema], default: [] },
  priority:     { type: String, enum: ['low','normal','high','urgent'], default: 'normal' },
  neededBy:     { type: Date, default: null },
  reason:       { type: String, default: '' },

  status: { type: String, enum: ['pending','approved','partially_approved','rejected','fulfilled','cancelled'], default: 'pending' },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:  { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fulfilledAt: { type: Date, default: null },
  notes:       { type: String, default: '' },
}, { timestamps: true });

IndentSchema.index({ status: 1, createdAt: -1 });
IndentSchema.index({ requestedBy: 1, createdAt: -1 });

IndentSchema.pre('save', function(next) {
  if (!this.indentNumber) {
    this.indentNumber = 'IND-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  next();
});

module.exports = mongoose.model('Indent', IndentSchema);
