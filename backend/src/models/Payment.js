// const mongoose = require('mongoose');

// const PaymentSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { type: String, enum: ['appointment', 'order'], required: true },
//   refId: { type: mongoose.Schema.Types.ObjectId, required: true }, // appointment or order _id
//   amount: { type: Number, required: true },
//   currency: { type: String, default: 'INR' },
//   method: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet'], default: 'card' },
//   status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
//   transactionId: { type: String, unique: true, sparse: true },
//   gatewayResponse: { type: Object },
//   cardLast4: { type: String },
//   cardBrand: { type: String },
//   description: { type: String },
//   paidAt: { type: Date },
// }, { timestamps: true });

// module.exports = mongoose.model('Payment', PaymentSchema);

const mongoose = require('mongoose');
const PaymentSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  order:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  type:          { type: String, enum: ['appointment','order','pharmacy','lab','admission','other'], default: 'appointment' },
  amount:        { type: Number, required: true },
  currency:      { type: String, default: 'INR' },
  status:        { type: String, enum: ['pending','success','failed','refunded'], default: 'pending' },
  method:        { type: String, enum: ['razorpay','upi','card','netbanking','wallet','cash','insurance'], default: 'razorpay' },
  // Razorpay fields
  razorpayOrderId:  { type: String, default: '' },
  razorpayPaymentId:{ type: String, default: '' },
  razorpaySignature:{ type: String, default: '' },
  transactionId:    { type: String, default: undefined, sparse: true },
  // Card details (masked)
  cardBrand:    { type: String, default: '' },
  cardLast4:    { type: String, default: '' },
  // Receipt
  receiptNo:    { type: String, unique: true, sparse: true },
  description:  { type: String, default: '' },
  notes:        { type: String, default: '' },
  paidAt:       { type: Date },
  refundedAt:   { type: Date },
  refundAmount: { type: Number, default: 0 },
  refundId:     { type: String, default: '' },        // gateway-side refund reference
  refundETA:    { type: Date, default: null },         // when funds should land back
  refundReason: { type: String, default: '' },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
module.exports = mongoose.model('Payment', PaymentSchema);
