const mongoose = require('mongoose');

// Radiology Information System order — covers the workflow from a doctor
// ordering imaging through to a signed-off report. Images are handled as
// uploaded file attachments (JPEG/PNG/PDF export from the imaging
// equipment) rather than a real DICOM/PACS viewer, which needs dedicated
// imaging hardware integration outside the scope of a web HMS.
const ImagingOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, sparse: true },
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // doctor
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  admission:   { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', default: null },

  modality: { type: String, enum: ['X-Ray','Ultrasound','CT Scan','MRI','Mammography','ECG','Other'], required: true },
  bodyPart: { type: String, default: '' },
  reason:   { type: String, required: true, trim: true },
  priority: { type: String, enum: ['routine','urgent','stat'], default: 'routine' },

  status: { type: String, enum: ['ordered','scheduled','in_progress','completed','reported','cancelled'], default: 'ordered' },
  scheduledAt: { type: Date, default: null },

  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // radiology tech
  performedAt: { type: Date, default: null },
  images: { type: [String], default: [] }, // uploaded file URLs

  report: {
    findings:   { type: String, default: '' },
    impression: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // reporting doctor/radiologist
    reportedAt: { type: Date, default: null },
  },

  cancelReason: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

ImagingOrderSchema.index({ status: 1, createdAt: -1 });
ImagingOrderSchema.index({ patient: 1, createdAt: -1 });

ImagingOrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'RAD-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  next();
});

module.exports = mongoose.model('ImagingOrder', ImagingOrderSchema);
