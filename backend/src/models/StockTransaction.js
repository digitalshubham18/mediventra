const mongoose = require('mongoose');

// Immutable ledger of every stock movement in the central store — every
// stock-in (purchase received), stock-out (indent fulfilled), and manual
// adjustment (correction/wastage/expiry write-off) gets a row here, so
// currentStock on InventoryItem is always reconstructable/auditable.
const StockTransactionSchema = new mongoose.Schema({
  item:      { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type:      { type: String, enum: ['in', 'out', 'adjustment'], required: true },
  quantity:  { type: Number, required: true }, // always positive; direction comes from `type`
  reason:    { type: String, default: '' }, // e.g. "Purchase from ABC Suppliers", "Wastage", "Expired stock"
  indent:    { type: mongoose.Schema.Types.ObjectId, ref: 'Indent', default: null }, // set when this is an indent fulfillment
  balanceAfter: { type: Number, required: true },
  performedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

StockTransactionSchema.index({ item: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);
