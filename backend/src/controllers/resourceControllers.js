const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const { Alert } = require('../models/Models');
const { buildFileUrl } = require('../middleware/upload');

// ─── MEDICINE CONTROLLER ───────────────────────────────────────────────

exports.getMedicines = async (req, res) => {
  try {
    let query = { isActive: true };
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { genericName: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.category) query.category = req.query.category;
    if (req.query.rx === 'true') query.requiresPrescription = true;
    if (req.query.rx === 'false') query.requiresPrescription = false;

    const medicines = await Medicine.find(query).sort({ name: 1 });
    res.json({ success: true, count: medicines.length, data: medicines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, error: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.create(req.body);
    res.status(201).json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!medicine) return res.status(404).json({ success: false, error: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteMedicine = async (req, res) => {
  try {
    await Medicine.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Medicine deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── ORDER CONTROLLER ─────────────────────────────────────────────────

exports.getOrders = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') query.patient = req.user.id;
    if (req.query.status) query.status = req.query.status;

    const orders = await Order.find(query)
      .populate('patient', 'name email phone')
      .populate('items.medicine', 'name price')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    // When called with a file attached (multipart/form-data), multer parses
    // the file into req.file and all other fields land in req.body as
    // strings — so `items`/`deliveryAddress` need a JSON.parse in that case.
    // When called as plain JSON (no Rx upload), they arrive already parsed.
    const items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
    const deliveryAddress = typeof req.body.deliveryAddress === 'string' ? JSON.parse(req.body.deliveryAddress) : req.body.deliveryAddress;
    const { deliveryNotes, paymentMethod } = req.body;
    const prescriptionPath = req.file ? buildFileUrl(req.file, 'prescriptions') : '';

    let totalAmount = 0;
    const orderItems = [];
    let anyRequiresPrescription = false;

    for (const item of items) {
      const medicine = await Medicine.findById(item.medicineId);
      if (!medicine) return res.status(404).json({ success: false, error: `Medicine ${item.medicineId} not found` });
      if (medicine.stock < item.quantity) {
        return res.status(400).json({ success: false, error: `Insufficient stock for ${medicine.name}` });
      }
      if (medicine.requiresPrescription) anyRequiresPrescription = true;
      const subtotal = medicine.price * item.quantity;
      totalAmount += subtotal;
      orderItems.push({
        medicine: medicine._id,
        medicineName: medicine.name,
        quantity: item.quantity,
        unitPrice: medicine.price,
        subtotal
      });
      // Reduce stock
      await Medicine.findByIdAndUpdate(medicine._id, { $inc: { stock: -item.quantity } });
    }

    // If any item in the cart requires a prescription, the order cannot be
    // placed without one having been uploaded.
    if (anyRequiresPrescription && !prescriptionPath) {
      return res.status(400).json({ success: false, error: 'One or more items require a prescription. Please upload your Rx before placing this order.' });
    }

    const order = await Order.create({
      patient: req.user.id,
      items: orderItems,
      totalAmount,
      deliveryAddress,
      deliveryNotes,
      paymentMethod: paymentMethod || 'cash',
      prescription: prescriptionPath,
      prescriptionRequired: anyRequiresPrescription,
      statusHistory: [{ status: 'processing', note: 'Order placed' }]
    });

    await order.populate('patient', 'name email phone');

    const io = req.app.get('io');
    if (io) io.emit('new_order', { orderId: order._id, orderNumber: order.orderNumber, patient: order.patient.name });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    order.status = status;
    order.processedBy = req.user.id;
    order.statusHistory.push({ status, note: note || '', updatedBy: req.user.id });
    if (status === 'delivered') order.deliveredAt = new Date();
    await order.save();

    await order.populate('patient', 'name email');

    const io = req.app.get('io');
    if (io) io.emit('order_updated', { orderId: order._id, status, patient: order.patient.name });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── ALERT CONTROLLER ─────────────────────────────────────────────────

exports.getAlerts = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') query.patient = req.user.id;
    if (req.query.status) query.status = req.query.status;
    if (req.query.severity) query.severity = req.query.severity;

    const alerts = await Alert.find(query)
      .populate('patient', 'name phone bloodGroup')
      .populate('respondedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const { type, severity, message, location } = req.body;

    const alert = await Alert.create({
      patient: req.user.id,
      triggeredBy: req.user.id,
      type: type || 'SOS',
      severity: severity || 'critical',
      message: message || 'Emergency SOS triggered',
      location: location || {}
    });

    await alert.populate('patient', 'name phone bloodGroup');

    const io = req.app.get('io');
    if (io) {
      io.emit('emergency_alert', {
        alertId:     alert._id,
        patientName: alert.patient?.name || 'Unknown',
        patient:     alert.patient?.name || 'Unknown',
        phone:       alert.patient?.phone || '',
        bloodGroup:  alert.patient?.bloodGroup || '',
        type:        alert.type,
        severity:    alert.severity,
        message:     alert.message,
        location:    alert.location,
        timestamp:   new Date()
      });
    }

    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, {
      status: 'acknowledged',
      respondedBy: req.user.id,
      respondedAt: new Date(),
    }, { new: true }).populate('patient', 'name').populate('respondedBy', 'name role');

    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });

    const io = req.app.get('io');
    if (io) io.emit('alert_acknowledged', { alertId: alert._id, patient: alert.patient.name, respondedBy: alert.respondedBy?.name });

    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      respondedBy: req.user.id,
      respondedAt: new Date(),
      resolvedAt: new Date(),
      resolutionNotes: req.body.notes || ''
    }, { new: true }).populate('patient', 'name');

    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });

    const io = req.app.get('io');
    if (io) io.emit('alert_resolved', { alertId: alert._id, patient: alert.patient.name });

    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};