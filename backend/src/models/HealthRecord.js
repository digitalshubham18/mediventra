const mongoose = require('mongoose');

const LabPhotoSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  filename: { type: String },
  size:     { type: Number },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
  // Who attached this specific photo, and when — every photo in the
  // history is individually attributed, not just the record as a whole.
  uploadedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedByName: { type: String, default: '' },
  uploadedByRole: { type: String, default: '' },
}, { _id: false });

// Full audit trail — answers "who updated this report and when" directly,
// every single time it's touched, not just the most recent state.
const UpdateHistorySchema = new mongoose.Schema({
  updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String, default: '' },
  updatedByRole: { type: String, default: '' },
  status:        { type: String, default: '' },
  notes:         { type: String, default: '' },
  at:            { type: Date, default: Date.now },
}, { _id: false });

const HealthRecordSchema = new mongoose.Schema({
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['lab_report','xray','mri','ct_scan','ecg','prescription','discharge_summary','vaccination','clinical_note','other'],
    default: 'lab_report'
  },
  // Lab/imaging workflow status — was missing from the schema entirely
  // before, so the frontend's status tracking was silently never being
  // persisted (Mongoose drops unknown fields under strict mode).
  status: {
    type: String,
    enum: ['pending','processing','completed','abnormal','rejected'],
    default: 'pending',
  },
  // Set when a lab technician rejects a sample (hemolyzed, insufficient
  // quantity, mislabeled, etc.) instead of processing it — the ordering
  // doctor/nurse needs to know a redraw is required.
  rejectionReason: { type: String, default: '' },
  // Primary file (PDF/document)
  fileUrl:     { type: String, default: '' },
  fileName:    { type: String, default: '' },
  fileSize:    { type: Number },
  mimeType:    { type: String, default: '' },
  // Lab photos - MANDATORY for lab_report, xray, mri, ct_scan, ecg types
  labPhotos:   { type: [LabPhotoSchema], default: [] },
  labPhotosRequired: { type: Boolean, default: false },
  updateHistory: { type: [UpdateHistorySchema], default: [] },
  // Test-specific fields
  testName:    { type: String, default: '' },
  testDate:    { type: Date },
  labName:     { type: String, default: '' },
  results:     { type: String, default: '' },
  resultNotes: { type: String, default: '' },
  normalRange: { type: String, default: '' },
  isAbnormal:  { type: Boolean, default: false },

  // ── Lab order fields ──────────────────────────────────────────────────
  // These were previously sent by the frontend (Order Lab Test form /
  // Lab Dashboard retry-sync) but never persisted because they weren't
  // declared on the schema — Mongoose silently dropped them under strict
  // mode. That meant a lab technician opening the order on a different
  // session/device saw no test list, no urgency, no clinical notes at
  // all. Now properly stored so every viewer sees the real order.
  tests:         { type: [String], default: [] },
  urgency:       { type: String, enum: ['routine','urgent','stat'], default: 'routine' },
  clinicalNotes: { type: String, default: '' },
  collectionDate:{ type: Date },
  doctorName:    { type: String, default: '' },

  // Which lab technician has claimed/is handling this order — like a
  // real HMS lab queue, an order can be picked up by one technician so
  // work isn't duplicated across the team.
  assignedLabTech:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedLabTechName: { type: String, default: '' },
  // Vitals (if applicable)
  vitals: {
    bloodPressure: String,
    heartRate:     Number,
    temperature:   Number,
    oxygenSat:     Number,
    weight:        Number,
    height:        Number,
  },
  notes:       { type: String, default: '' },
  isPrivate:   { type: Boolean, default: false },
  tags:        [String],
}, { timestamps: true });

module.exports = mongoose.model('HealthRecord', HealthRecordSchema);
