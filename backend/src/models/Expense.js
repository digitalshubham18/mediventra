const mongoose = require('mongoose');

// Non-salary hospital expenses — utilities, maintenance, supplies, equipment,
// etc. Kept separate from Salary so payroll and operating costs can be
// reported on independently, but both roll up into the same Budget category
// system (see Budget.js) for a combined "actual spend" picture.
const ExpenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['utilities','maintenance','supplies','equipment','rent','marketing','administrative','pharmacy_stock','other'],
    required: true,
  },
  description:   { type: String, required: true, trim: true },
  amount:        { type: Number, required: true, min: 0 },
  vendor:        { type: String, default: '' },
  department:    { type: String, default: '' },
  expenseDate:   { type: Date, required: true, default: Date.now },
  paymentMode:   { type: String, enum: ['cash','cheque','bank_transfer','upi','card'], default: 'cash' },
  // Manual payment paper trail — mirrors Salary.manualPaymentDetails
  receiptNumber:  { type: String, default: '' },
  chequeNumber:   { type: String, default: '' },
  chequeBankName: { type: String, default: '' },
  chequeDate:     { type: Date, default: null },
  notes:         { type: String, default: '' },
  attachmentUrl: { type: String, default: '' }, // scanned bill/receipt, if uploaded
  addedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ category: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
