const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true
  },
  genericName: { type: String, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['Pain Relief', 'Antibiotics', 'Anti-inflammatory', 'Gastric', 'Allergy',
           'Diabetes', 'Cholesterol', 'Cardiac', 'Supplements', 'Dermatology',
           'Respiratory', 'Neurology', 'Oncology', 'Vitamins', 'Other']
  },
  description: { type: String, default: '' },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  stock: {
    type: Number,
    required: true,
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  minStock: { type: Number, default: 50 },
  requiresPrescription: { type: Boolean, default: false },
  manufacturer: { type: String, default: '' },
  expiryDate: { type: Date },
  batchNumber: { type: String, default: '' },
  dosageForm: {
    type: String,
    enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Patch', 'Other'],
    default: 'Tablet'
  },
  strength: { type: String, default: '' },
  sideEffects: [String],
  contraindications: [String],
  isActive: { type: Boolean, default: true },
  icon: { type: String, default: '💊' },
  images: [String]
}, {
  timestamps: true
});

MedicineSchema.index({ name: 'text', genericName: 'text' });
MedicineSchema.index({ category: 1 });
MedicineSchema.index({ requiresPrescription: 1 });

MedicineSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.minStock;
});

module.exports = mongoose.model('Medicine', MedicineSchema);