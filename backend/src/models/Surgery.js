const mongoose = require('mongoose');

// WHO Surgical Safety Checklist — the standard three-phase list used
// worldwide (Sign In / Time Out / Sign Out). Surgery cannot move to
// "in_progress" until every item is checked off, and cannot be marked
// "completed" until Sign Out items are done too.
const DEFAULT_CHECKLIST = [
  // Sign In — before induction of anaesthesia
  { phase: 'sign_in',  item: 'Patient identity, site, procedure and consent confirmed' },
  { phase: 'sign_in',  item: 'Surgical site marked / not applicable' },
  { phase: 'sign_in',  item: 'Anaesthesia safety check completed' },
  { phase: 'sign_in',  item: 'Pulse oximeter on patient and functioning' },
  { phase: 'sign_in',  item: 'Known allergies reviewed' },
  { phase: 'sign_in',  item: 'Difficult airway / aspiration risk assessed' },
  { phase: 'sign_in',  item: 'Risk of >500ml blood loss assessed, IV access adequate' },
  // Time Out — before skin incision
  { phase: 'time_out', item: 'All team members introduced by name and role' },
  { phase: 'time_out', item: 'Patient, site and procedure confirmed by full team' },
  { phase: 'time_out', item: 'Anticipated critical events discussed (surgeon/anaesthetist/nursing)' },
  { phase: 'time_out', item: 'Antibiotic prophylaxis given in last 60 minutes / not applicable' },
  { phase: 'time_out', item: 'Essential imaging displayed / not applicable' },
  { phase: 'time_out', item: 'Sterility of instruments confirmed (including indicator results)' },
  // Sign Out — before patient leaves OT
  { phase: 'sign_out', item: 'Instrument, sponge and needle counts correct' },
  { phase: 'sign_out', item: 'Specimen labelled correctly / not applicable' },
  { phase: 'sign_out', item: 'Equipment problems to be addressed identified' },
  { phase: 'sign_out', item: 'Key concerns for recovery and post-op management reviewed' },
];

const SurgerySchema = new mongoose.Schema({
  surgeryNumber: { type: String, unique: true, sparse: true },
  patient:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  procedureName:  { type: String, required: true },
  reason:         { type: String, default: '' },

  primarySurgeon: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assistants:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  anesthetist:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nurses:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  otRoom:         { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', required: true },

  scheduledStart: { type: Date, required: true },
  scheduledEnd:   { type: Date, required: true }, // estimated
  actualStart:    { type: Date, default: null },
  actualEnd:      { type: Date, default: null },
  durationMinutes:{ type: Number, default: null }, // captured once completed

  status: { type: String, enum: ['scheduled','pre_op','in_progress','completed','cancelled'], default: 'scheduled' },
  cancelReason: { type: String, default: '' },

  checklist: {
    type: [{
      phase:      { type: String, enum: ['sign_in','time_out','sign_out'], required: true },
      item:       { type: String, required: true },
      checked:    { type: Boolean, default: false },
      checkedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      checkedAt:  { type: Date, default: null },
    }],
    default: () => DEFAULT_CHECKLIST.map(c => ({ ...c })),
  },

  notes:      { type: String, default: '' },
  postOpNotes:{ type: String, default: '' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

SurgerySchema.index({ otRoom: 1, scheduledStart: 1 });
SurgerySchema.index({ status: 1, scheduledStart: 1 });
SurgerySchema.index({ primarySurgeon: 1, scheduledStart: 1 });

SurgerySchema.pre('save', function(next) {
  if (!this.surgeryNumber) {
    this.surgeryNumber = 'SUR-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  next();
});

SurgerySchema.statics.DEFAULT_CHECKLIST = DEFAULT_CHECKLIST;

module.exports = mongoose.model('Surgery', SurgerySchema);
