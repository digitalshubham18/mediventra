const mongoose = require('mongoose');

// Daily wearable/vitals data. Populated three ways:
// 1. Manual entry — works today, no external account needed.
// 2. File import — upload a CSV export from any wearable/health app
//    (Fitbit, Google Fit, Samsung Health all support exporting your own
//    data as CSV) — no OAuth or developer account required on our side.
// 3. Fitbit sync — real OAuth2 integration (see wearableController.js);
//    requires the hospital to register a free Fitbit developer app and
//    set FITBIT_CLIENT_ID/SECRET in .env. Without those, the Fitbit
//    button simply explains what's needed rather than pretending to sync.
// Apple Health is intentionally NOT offered as a live-sync option — it
// has no web API of any kind (HealthKit is on-device/iOS-only by
// Apple's own design) — but its CSV/export data works fine via import.
const WearableEntrySchema = new mongoose.Schema({
  patient:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:       { type: Date, required: true, default: Date.now },
  source:     { type: String, enum: ['manual', 'fitbit', 'import', 'google_fit', 'nurse'], default: 'manual' },
  steps:      { type: Number },
  heartRate:  { type: Number }, // resting bpm
  sleepHours: { type: Number },
  caloriesBurned: { type: Number },
  // Chronic-disease-monitoring vitals — the fields that make this a real
  // patient vitals tracker rather than just a fitness step-counter.
  weight:      { type: Number }, // kg
  spo2:        { type: Number }, // % oxygen saturation
  bpSystolic:  { type: Number }, // mmHg
  bpDiastolic: { type: Number }, // mmHg
  bloodGlucose:{ type: Number }, // mg/dL
  // Bedside/clinical vitals — recorded by a nurse at the ward, not by a
  // wearable device.
  temperature:     { type: Number }, // °F
  respiratoryRate: { type: Number }, // breaths/min
  recordedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // nurse/doctor who took the reading, if not the patient

  // Set automatically whenever a value falls outside a safe range, so
  // the patient sees a clear warning and the last treating doctor gets
  // notified — this is what turns "logging numbers" into something a
  // real hospital can act on.
  flagged: { type: Boolean, default: false },
  flagReasons: { type: [String], default: [] },
}, { timestamps: true });

WearableEntrySchema.index({ patient: 1, date: -1 });

module.exports = mongoose.model('WearableEntry', WearableEntrySchema);
