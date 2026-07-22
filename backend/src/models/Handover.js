const mongoose = require('mongoose');

// A structured note the outgoing shift fills out so the incoming shift
// has everything they need — which patients need special attention,
// what's still pending, anything unusual. Shown to the next person
// clocking in for the same role/ward.
const HandoverSchema = new mongoose.Schema({
  fromUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromRole:  { type: String, required: true },
  shift:     { type: String, enum: ['morning', 'evening', 'night'], required: true },

  criticalPatients: { type: String, default: '' }, // free text: names/rooms needing attention
  pendingTasks:     { type: String, default: '' },
  notes:            { type: String, default: '' },

  acknowledgedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // who on the next shift has read it
}, { timestamps: true });

HandoverSchema.index({ fromRole: 1, createdAt: -1 });

module.exports = mongoose.model('Handover', HandoverSchema);
