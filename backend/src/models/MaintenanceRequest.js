const mongoose = require('mongoose');

// Any staff member can report a facility issue near them (a leaking sink,
// a flickering light, a frozen workstation) and it routes straight to the
// matching trade's queue — previously the only way an issue reached a
// technician was an admin manually creating a Task for them.
const MaintenanceRequestSchema = new mongoose.Schema({
  category:    { type: String, enum: ['electrical', 'plumbing', 'biomedical', 'it', 'general'], required: true },
  location:    { type: String, required: true }, // e.g. "Ward B, Room 12" or "OPD Reception"
  description: { type: String, required: true },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status:      { type: String, enum: ['open', 'claimed', 'resolved'], default: 'open' },
  reportedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNotes: { type: String, default: '' },
  resolvedAt:  { type: Date, default: null },
}, { timestamps: true });

MaintenanceRequestSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('MaintenanceRequest', MaintenanceRequestSchema);
