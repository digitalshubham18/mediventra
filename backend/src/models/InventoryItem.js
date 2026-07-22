const mongoose = require('mongoose');

// Item master for the CENTRAL STORE — general hospital consumables,
// surgical supplies, linen, PPE, stationery, equipment etc. Deliberately
// separate from the Medicine model, which is pharmacy/drug stock with its
// own prescription-driven workflow.
const InventoryItemSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  category:    {
    type: String,
    enum: ['Consumables','Surgical Supplies','Linen','PPE','Stationery','Housekeeping','Equipment','Diagnostics','Other'],
    default: 'Consumables',
  },
  unit:        { type: String, enum: ['pcs','box','pack','kg','g','liter','ml','roll','pair','set'], default: 'pcs' },
  currentStock:{ type: Number, default: 0, min: 0 },
  minStock:    { type: Number, default: 10, min: 0 }, // reorder threshold
  unitCost:    { type: Number, default: 0, min: 0 },
  supplier:    { type: String, default: '' },
  storeLocation: { type: String, default: 'Central Store' }, // shelf/rack, if tracked
  isActive:    { type: Boolean, default: true },
  notes:       { type: String, default: '' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

InventoryItemSchema.index({ category: 1 });
InventoryItemSchema.index({ name: 'text' });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
