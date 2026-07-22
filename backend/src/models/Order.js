const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  medicineName: String,
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [OrderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'processing'
  },
  prescription: {
    type: String,
    default: ''
  },
  prescriptionRequired: { type: Boolean, default: false },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  deliveryNotes: { type: String, default: '' },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  estimatedDelivery: Date,
  deliveredAt: Date,
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'insurance', 'online'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Auto-generate order number
OrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', OrderSchema);