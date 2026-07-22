const mongoose = require('mongoose');

// One allocation per category per month/year. "payroll" is a special
// category whose actual spend is computed from credited Salary records
// rather than Expense records — see budgetController.getSummary.
const BudgetSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['payroll','utilities','maintenance','supplies','equipment','rent','marketing','administrative','pharmacy_stock','other'],
    required: true,
  },
  month:           { type: Number, required: true, min: 1, max: 12 },
  year:            { type: Number, required: true },
  allocatedAmount: { type: Number, required: true, min: 0 },
  notes:           { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

BudgetSchema.index({ category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
