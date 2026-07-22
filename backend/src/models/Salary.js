// const mongoose = require('mongoose');

// const SalarySchema = new mongoose.Schema({
//   employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   month:        { type: Number, required: true },   // 1-12
//   year:         { type: Number, required: true },
//   basicPay:     { type: Number, required: true, default: 0 },
//   allowances:   {
//     hra:        { type: Number, default: 0 },  // House Rent
//     da:         { type: Number, default: 0 },  // Dearness
//     ta:         { type: Number, default: 0 },  // Travel
//     medical:    { type: Number, default: 0 },
//     special:    { type: Number, default: 0 },
//   },
//   deductions:   {
//     pf:         { type: Number, default: 0 },  // Provident Fund
//     esi:        { type: Number, default: 0 },  // ESI
//     tax:        { type: Number, default: 0 },  // TDS
//     absent:     { type: Number, default: 0 },  // Leave without pay
//     loan:       { type: Number, default: 0 },
//     other:      { type: Number, default: 0 },
//   },
//   grossPay:     { type: Number, default: 0 },
//   netPay:       { type: Number, default: 0 },
//   status:       { type: String, enum: ['pending','credited','held'], default: 'pending' },
//   creditedAt:   { type: Date },
//   creditedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   paymentMode:  { type: String, enum: ['bank_transfer','cheque','cash'], default: 'bank_transfer' },
//   bankAccount:  { type: String, default: '' },
//   remarks:      { type: String, default: '' },
//   daysWorked:   { type: Number, default: 26 },
//   daysAbsent:   { type: Number, default: 0 },
//   leaveDaysDeducted: { type: Number, default: 0 },
//   resultNotes:  { type: String, default: '' },
//   overtimeHours:{ type: Number, default: 0 },
//   overtimePay:  { type: Number, default: 0 },
// }, { timestamps: true });

// // Ensure one salary record per employee per month/year
// SalarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

// module.exports = mongoose.model('Salary', SalarySchema);


const mongoose = require('mongoose');
const SalarySchema = new mongoose.Schema({
  employee:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  month:        { type: Number, required:true },
  year:         { type: Number, required:true },
  basicPay:     { type: Number, default:0 },
  allowances:   { hra:{type:Number,default:0}, da:{type:Number,default:0}, ta:{type:Number,default:0}, medical:{type:Number,default:0}, special:{type:Number,default:0} },
  deductions:   { pf:{type:Number,default:0}, esi:{type:Number,default:0}, tax:{type:Number,default:0}, absent:{type:Number,default:0}, lateFine:{type:Number,default:0}, loan:{type:Number,default:0}, other:{type:Number,default:0} },
  grossPay:     { type: Number, default:0 },
  netPay:       { type: Number, default:0 },
  daysWorked:   { type: Number, default:26 },
  daysAbsent:   { type: Number, default:0 },
  lateDays:     { type: Number, default:0 }, // unwaived late days this month, each fined ₹50
  overtimeHours:{ type: Number, default:0 },
  overtimePay:  { type: Number, default:0 },
  status:       { type: String, enum:['pending','credited','held','failed'], default:'pending' },
  creditedAt:   { type: Date },
  creditedBy:   { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  paymentMode:  { type: String, enum:['bank_transfer','cheque','cash'], default:'bank_transfer' },
  bankAccount:  { type: String, default:'' },
  remarks:      { type: String, default:'' },
  // ── Real-money audit trail ──────────────────────────────────────────
  transactionRef:  { type: String, default: '' },  // generated only on a successful credit
  bankSnapshot:    {                                 // account details used at time of credit
    accountHolder: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifsc:          { type: String, default: '' },
    bankName:      { type: String, default: '' },
  },
  failureReason:   { type: String, default: '' },   // why a credit attempt failed (bad/missing bank details)
  // ── Manual (cash/cheque) payment details ────────────────────────────
  // Required when paymentMode is 'cash' (receiptNumber) or 'cheque'
  // (chequeNumber/chequeBankName/chequeDate) — captured at credit time.
  manualPaymentDetails: {
    receiptNumber:  { type: String, default: '' },  // cash payments
    chequeNumber:   { type: String, default: '' },  // cheque payments
    chequeBankName: { type: String, default: '' },
    chequeBranch:   { type: String, default: '' },
    chequeDate:     { type: Date, default: null },
    payeeName:      { type: String, default: '' },
  },
  // Ad-hoc extra payments (bonus, arrears, reimbursement, etc.) finance can
  // add on top of the regular monthly salary at any time — independent of
  // whether the base salary has already been credited.
  extraPayments: {
    type: [{
      amount:  { type: Number, required: true },
      reason:  { type: String, default: '' },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
}, { timestamps:true });
SalarySchema.index({ employee:1, month:1, year:1 }, { unique:true });
module.exports = mongoose.model('Salary', SalarySchema);
