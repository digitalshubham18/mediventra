const mongoose = require('mongoose');

// One document per blood group — the hospital's current blood bank stock.
const BloodInventorySchema = new mongoose.Schema({
  bloodGroup: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'], required: true, unique: true },
  units:      { type: Number, default: 0, min: 0 }, // 1 unit ≈ 450ml
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('BloodInventory', BloodInventorySchema);
