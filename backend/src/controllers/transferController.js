const TransferRequest = require('../models/TransferRequest');

// GET /api/transfers — open queue (unassigned) + a wardboy's own active transfers;
// doctors/nurses/admin/receptionist see everything recent instead.
exports.getTransfers = async (req, res) => {
  try {
    let q;
    if (req.user.role === 'wardboy') {
      q = { $or: [{ status: 'requested' }, { wardboy: req.user.id }] };
    } else {
      q = {};
    }
    const transfers = await TransferRequest.find(q)
      .populate('patient', 'name').populate('requestedBy', 'name role').populate('wardboy', 'name phone')
      .sort({ priority: -1, createdAt: -1 }).limit(100);
    res.json({ success: true, data: transfers });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/transfers — doctor/nurse/receptionist/admin requests a patient move
exports.createTransfer = async (req, res) => {
  try {
    const { patientId, patientName, fromLocation, toLocation, reason, priority } = req.body;
    if (!fromLocation || !toLocation) return res.status(400).json({ success: false, error: 'From and To locations are required' });

    const transfer = await TransferRequest.create({
      patient: patientId || undefined, patientName: patientName || '',
      fromLocation, toLocation, reason: reason || '', priority: priority === 'urgent' ? 'urgent' : 'routine',
      requestedBy: req.user.id,
    });

    const io = req.app.get('io');
    if (io) io.emit('transfer_requested', {
      transferId: transfer._id, patientName: transfer.patientName, fromLocation, toLocation,
      priority: transfer.priority,
    });

    res.status(201).json({ success: true, data: transfer });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/transfers/:id/accept — a wardboy picks up an open request
exports.acceptTransfer = async (req, res) => {
  try {
    const transfer = await TransferRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'requested' },
      { wardboy: req.user.id, status: 'assigned', assignedAt: new Date() },
      { new: true }
    ).populate('requestedBy', 'name');
    if (!transfer) return res.status(409).json({ success: false, error: 'This transfer was already picked up by someone else, or no longer exists.' });

    const io = req.app.get('io');
    if (io) io.emit('transfer_updated', { transferId: transfer._id, status: 'assigned', wardboyName: req.user.name });

    res.json({ success: true, data: transfer });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/transfers/:id/progress — in_transit / completed / cancelled
exports.updateProgress = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['in_transit','completed','cancelled'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const transfer = await TransferRequest.findById(req.params.id);
    if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });
    if (req.user.role !== 'admin' && transfer.wardboy?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only update your own assigned transfers' });
    }

    transfer.status = status;
    if (status === 'in_transit') transfer.inTransitAt = new Date();
    if (status === 'completed') transfer.completedAt = new Date();
    await transfer.save();

    const io = req.app.get('io');
    if (io) io.emit('transfer_updated', { transferId: transfer._id, status });

    res.json({ success: true, data: transfer });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
