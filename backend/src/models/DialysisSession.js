const mongoose = require('mongoose');

// A single dialysis session for a patient. Designed around recurring
// treatment (most dialysis patients are on a fixed weekly schedule), with
// pre/post vitals for the standard safety check and consumables usage
// linked into the central Inventory module so dialyzer/tubing stock
// actually depletes as sessions happen.
const DialysisSessionSchema = new mongoose.Schema({
  patient:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTech:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  stationNumber: { type: String, default: '' }, // which dialysis machine/bay
  accessType:    { type: String, enum: ['Fistula','Graft','Catheter',''], default: '' },
  dialyzerType:  { type: String, default: '' },

  scheduledDate: { type: Date, required: true },
  scheduledStart:{ type: String, required: true }, // "09:00"
  scheduledDurationMinutes: { type: Number, default: 240 }, // typical session ~4 hrs

  status: { type: String, enum: ['scheduled','in_progress','completed','cancelled','no_show'], default: 'scheduled' },

  preVitals:  { weight: Number, bloodPressure: String, pulse: Number, temperature: Number },
  postVitals: { weight: Number, bloodPressure: String, pulse: Number, temperature: Number },

  actualStart: { type: Date, default: null },
  actualEnd:   { type: Date, default: null },
  durationMinutes: { type: Number, default: null },

  consumablesUsed: {
    type: [{
      item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
      quantity: { type: Number, required: true, min: 1 },
    }],
    default: [],
  },

  complications: { type: String, default: '' },
  notes: { type: String, default: '' },
  cancelReason: { type: String, default: '' },

  // Recurring-schedule helper — when a session is completed, the frontend
  // can offer to create the next one this many days out (defaults to a
  // weekly cadence, the most common for chronic dialysis patients).
  recurrenceDays: { type: Number, default: 7 },
}, { timestamps: true });

DialysisSessionSchema.index({ patient: 1, scheduledDate: -1 });
DialysisSessionSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model('DialysisSession', DialysisSessionSchema);
