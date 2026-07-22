const mongoose = require('mongoose');

const AmbulanceTripSchema = new mongoose.Schema({
  // Unassigned until a driver accepts a patient-submitted request — so
  // this can no longer be required the way it was when every trip was
  // self-logged by a driver who already knew their own id.
  driver:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Set only for patient-initiated requests (as opposed to a driver
  // logging their own trip, or admin/receptionist dispatching one).
  requestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  from:          { type: String, required: true },
  to:            { type: String, required: true },
  purpose:       { type: String, default: '' },
  patientName:   { type: String, default: '' },
  contactPhone:  { type: String, default: '' },
  isEmergency:   { type: Boolean, default: false },
  scheduledTime: { type: String, default: '' }, // e.g. "14:30"
  date:          { type: Date, default: Date.now },
  // 'requested' → 'dispatched' (driver accepted) → 'en_route' → 'arrived'
  // → 'completed'. 'pending' is kept only for the original driver-logs-
  // their-own-trip flow, which never goes through the request queue.
  status:        { type: String, enum: ['requested','pending','dispatched','en_route','arrived','completed','cancelled'], default: 'pending' },
  notes:         { type: String, default: '' },
  dispatchedAt:  { type: Date },
  enRouteAt:     { type: Date },
  arrivedAt:     { type: Date },
  completedAt:   { type: Date, default: null },
  cancelReason:  { type: String, default: '' },
}, { timestamps: true });

AmbulanceTripSchema.index({ driver: 1, date: -1 });
AmbulanceTripSchema.index({ requestedBy: 1, date: -1 });
AmbulanceTripSchema.index({ status: 1 });

module.exports = mongoose.model('AmbulanceTrip', AmbulanceTripSchema);
