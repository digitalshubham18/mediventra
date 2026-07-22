const mongoose = require('mongoose');

// A doctor shares an ANONYMIZED clinical snapshot with another doctor
// for a second opinion. "Anonymized" here means the patient's name,
// contact info, and any other directly-identifying fields are stripped
// before being stored/shown — only clinical content (diagnosis,
// symptoms, test results, age band, gender) is shared. A true "global
// specialist network" would require real external partnerships this
// system doesn't have; this is the honest, real version of the same
// idea scoped to specialists already on this platform.
const PeerConsultSchema = new mongoose.Schema({
  fromDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toDoctor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  ageBand:        { type: String, default: '' },
  gender:         { type: String, default: '' },
  summary:        { type: String, required: true },
  diagnosis:      { type: String, default: '' },
  testResults:    { type: String, default: '' },

  status:   { type: String, enum: ['pending', 'responded'], default: 'pending' },
  response: { type: String, default: '' },
  respondedAt: { type: Date },
}, { timestamps: true });

PeerConsultSchema.index({ toDoctor: 1, status: 1 });

module.exports = mongoose.model('PeerConsult', PeerConsultSchema);
