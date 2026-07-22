const mongoose = require('mongoose');

// Health Record
const HealthRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['Blood Report', 'X-Ray', 'ECG', 'MRI', 'CT Scan', 'Ultrasound', 'Prescription', 'Discharge Summary', 'Lab Report', 'Other'],
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  notes: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: '' },
  isConfidential: { type: Boolean, default: false },
  tags: [String],
  values: { type: Map, of: String }
}, { timestamps: true });

// Medication Reminder
const ReminderSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  medicineName: { type: String },
  dose: { type: String, required: true },
  frequency: {
    type: String,
    enum: ['Once Daily', 'Twice Daily', 'Every 8 hours', 'Every 6 hours', 'Weekly', 'As Needed'],
    default: 'Once Daily'
  },
  times: [String],
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active' },
  notes: { type: String, default: '' },
  adherenceLog: [{
    date: Date,
    taken: Boolean,
    takenAt: Date,
    skippedReason: String
  }],
  notificationsEnabled: { type: Boolean, default: true },
  prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Emergency Alert
const AlertSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['SOS', 'Medication', 'Vitals', 'Fall', 'Custom'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: { type: String, required: true },
  location: {
    lat: Number,
    lng: Number,
    description: String
  },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'resolved', 'escalated'],
    default: 'pending'
  },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondedAt: Date,
  resolvedAt: Date,
  resolutionNotes: { type: String, default: '' },
  notifiedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = {
  HealthRecord:
    mongoose.models.HealthRecord ||
    mongoose.model('HealthRecord', HealthRecordSchema),

  Reminder:
    mongoose.models.Reminder ||
    mongoose.model('Reminder', ReminderSchema),

  Alert:
    mongoose.models.Alert ||
    mongoose.model('Alert', AlertSchema)
};