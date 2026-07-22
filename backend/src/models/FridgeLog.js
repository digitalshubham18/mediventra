const mongoose = require('mongoose');

// No physical IoT temperature sensors exist to poll here, so this is a
// manual logging system: staff record the current reading periodically,
// and the system flags anything outside the safe range immediately —
// same alerting logic a real sensor feed would use. If real IoT hardware
// is added later, its readings can post to the same collection/route
// with source:'sensor' and everything downstream (alerts, dashboard)
// keeps working unchanged.
const FridgeLogSchema = new mongoose.Schema({
  unitName:    { type: String, required: true }, // e.g. 'Vaccine Fridge — Pharmacy', 'Blood Bank Unit 1'
  temperature: { type: Number, required: true }, // °C
  safeMin:     { type: Number, default: 2 },
  safeMax:     { type: Number, default: 8 },
  source:      { type: String, enum: ['manual', 'sensor'], default: 'manual' },
  loggedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAlert:     { type: Boolean, default: false },
}, { timestamps: true });

FridgeLogSchema.index({ unitName: 1, createdAt: -1 });

module.exports = mongoose.model('FridgeLog', FridgeLogSchema);
