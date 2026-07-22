const ImagingOrder = require('../models/ImagingOrder');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const { buildFileUrl, cloudinaryEnabled } = require('../middleware/upload');
const { notify } = require('../utils/notify');
const { logAction } = require('../utils/auditLog');

const POP = [
  { path: 'patient', select: 'name phone age bloodGroup' },
  { path: 'orderedBy', select: 'name specialization' },
  { path: 'performedBy', select: 'name' },
  { path: 'report.reportedBy', select: 'name specialization' },
];

// POST /api/radiology/orders — doctor orders imaging for a patient
exports.createOrder = async (req, res) => {
  try {
    const { patient, modality, bodyPart, reason, priority, appointment, admission } = req.body;
    if (!patient || !modality || !reason?.trim()) {
      return res.status(400).json({ success: false, error: 'Patient, modality, and reason are required' });
    }
    const order = await ImagingOrder.create({
      patient, orderedBy: req.user.id, modality, bodyPart: bodyPart?.trim() || '', reason: reason.trim(),
      priority: priority || 'routine', appointment: appointment || null, admission: admission || null,
    });
    await order.populate(POP);

    const techs = await User.find({ role: 'radiology_tech', status: 'approved' }).select('_id');
    for (const t of techs) {
      await notify(req, t._id, {
        type: 'imaging_ordered', title: `🩻 New ${modality} order`,
        message: `${order.patient.name} — ${order.reason}${priority !== 'routine' ? ` (${priority.toUpperCase()})` : ''}`,
        link: '/radiology', icon: '🩻',
      });
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/radiology/orders?status=&patientId=
exports.getOrders = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.patient = req.user.id;
    else if (req.user.role === 'doctor' && req.query.mine === '1') q.orderedBy = req.user.id;
    else if (req.query.patientId) q.patient = req.query.patientId;
    if (req.query.status) q.status = req.query.status;
    const orders = await ImagingOrder.find(q).populate(POP).sort({ priority: 1, createdAt: -1 });
    // Sort urgent/stat first without a full aggregation — small dataset per query
    const priorityRank = { stat: 0, urgent: 1, routine: 2 };
    orders.sort((a, b) => (priorityRank[a.priority] - priorityRank[b.priority]) || (new Date(b.createdAt) - new Date(a.createdAt)));
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/radiology/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const order = await ImagingOrder.findById(req.params.id).populate(POP);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (req.user.role === 'patient' && String(order.patient._id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/radiology/orders/:id/schedule
exports.scheduleOrder = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ success: false, error: 'scheduledAt is required' });
    const order = await ImagingOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'ordered') return res.status(400).json({ success: false, error: `Cannot schedule from status "${order.status}"` });
    order.status = 'scheduled';
    order.scheduledAt = new Date(scheduledAt);
    await order.save();
    await order.populate(POP);
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/radiology/orders/:id/start
exports.startOrder = async (req, res) => {
  try {
    const order = await ImagingOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (!['ordered', 'scheduled'].includes(order.status)) return res.status(400).json({ success: false, error: `Cannot start from status "${order.status}"` });
    order.status = 'in_progress';
    order.performedBy = req.user.id;
    await order.save();
    await order.populate(POP);
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/radiology/orders/:id/complete — radiology tech uploads images, marks scan done
exports.completeOrder = async (req, res) => {
  try {
    const order = await ImagingOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Order must be in progress to complete it' });

    const newImages = (req.files || []).map(f => buildFileUrl(f, 'radiology'));
    // Compulsory: a scan cannot be marked complete without at least one uploaded
    // image/report file (either just now, or already attached earlier).
    if (newImages.length === 0 && order.images.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one scan image/report file must be uploaded before completing this scan' });
    }
    order.images = [...order.images, ...newImages];
    order.status = 'completed';
    order.performedBy = order.performedBy || req.user.id;
    order.performedAt = new Date();
    await order.save();
    await order.populate(POP);

    await notify(req, order.orderedBy._id, {
      type: 'imaging_completed', title: `🩻 ${order.modality} completed`,
      message: `${order.patient.name}'s scan is done — awaiting your report`,
      link: '/radiology', icon: '🩻',
    });

    logAction({
      actor: req.user, action: 'radiology_scan_completed',
      description: `Completed ${order.modality} scan for ${order.patient?.name || 'patient'} — ${newImages.length} file(s) uploaded`,
      targetType: 'ImagingOrder', targetId: order._id,
      meta: { modality: order.modality, imagesUploaded: newImages.length, totalImages: order.images.length },
    });

    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/radiology/orders/:id/report — doctor/radiologist writes and signs off the report
exports.submitReport = async (req, res) => {
  try {
    const { findings, impression } = req.body;
    if (!impression?.trim()) return res.status(400).json({ success: false, error: 'An impression/conclusion is required to sign off a report' });
    const order = await ImagingOrder.findById(req.params.id).populate('patient', 'name');
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'completed') return res.status(400).json({ success: false, error: 'Imaging must be completed before a report can be filed' });

    order.report = { findings: findings?.trim() || '', impression: impression.trim(), reportedBy: req.user.id, reportedAt: new Date() };
    order.status = 'reported';
    await order.save();
    await order.populate(POP);

    await notify(req, order.patient._id, {
      type: 'imaging_report', title: `🩻 Your ${order.modality} report is ready`,
      message: 'Your imaging report has been signed off and is available now',
      link: '/radiology', icon: '🩻',
    });

    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/radiology/orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await ImagingOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (['completed', 'reported', 'cancelled'].includes(order.status)) return res.status(400).json({ success: false, error: `Cannot cancel an order that is already ${order.status}` });
    order.status = 'cancelled';
    order.cancelReason = reason?.trim() || '';
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// DELETE /api/radiology/orders/:id — admin only, removes the order and any uploaded scan files
exports.deleteOrder = async (req, res) => {
  try {
    const order = await ImagingOrder.findById(req.params.id).populate('patient', 'name');
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    (order.images || []).forEach(url => {
      if (/^https?:\/\//i.test(url)) {
        if (cloudinaryEnabled) {
          try {
            const cloudinary = require('cloudinary').v2;
            const publicId = url.split('/upload/')[1]?.replace(/^v\d+\//, '').replace(/\.[^./]+$/, '');
            if (publicId) cloudinary.uploader.destroy(publicId, { resource_type: 'auto' }).catch(() => {});
          } catch {}
        }
        return;
      }
      const fp = path.join(__dirname, '../../', url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });

    await order.deleteOne();
    logAction({
      actor: req.user, action: 'radiology_order_deleted',
      description: `Deleted ${order.modality} report for ${order.patient?.name || 'unknown patient'}`,
      targetType: 'ImagingOrder', targetId: order._id,
    });
    res.json({ success: true, message: 'Radiology report deleted' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
