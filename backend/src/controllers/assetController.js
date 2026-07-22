const Asset = require('../models/Asset');
const { logAction } = require('../utils/auditLog');

exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.type) q.type = req.query.type;
    if (req.query.types) q.type = { $in: req.query.types.split(',') };
    const assets = await Asset.find(q).populate('lastUpdatedBy', 'name').populate('assignedTo', 'name role').sort({ updatedAt: -1 });
    res.json({ success: true, data: assets });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/assets/mine — equipment currently checked out to me
exports.getMine = async (req, res) => {
  try {
    const assets = await Asset.find({ assignedTo: req.user.id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: assets });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/assets/due-service — items whose preventive maintenance is due or overdue (electrician/plumber use)
exports.getDueForService = async (req, res) => {
  try {
    const assets = await Asset.find({ nextServiceDue: { $ne: null, $lte: new Date(Date.now() + 7*24*60*60*1000) } }).sort({ nextServiceDue: 1 });
    res.json({ success: true, data: assets });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { name, type, currentLocation, notes, nextServiceDue } = req.body;
    if (!name || !currentLocation) return res.status(400).json({ success: false, error: 'name and currentLocation are required' });
    const asset = await Asset.create({ name, type, currentLocation, notes, nextServiceDue: nextServiceDue || null, lastUpdatedBy: req.user.id });
    res.status(201).json({ success: true, data: asset });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/assets/:id — move it / update status
exports.update = async (req, res) => {
  try {
    const { currentLocation, status, notes } = req.body;
    const asset = await Asset.findByIdAndUpdate(req.params.id, {
      ...(currentLocation && { currentLocation }), ...(status && { status }), ...(notes !== undefined && { notes }),
      lastUpdatedBy: req.user.id,
    }, { new: true });
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true, data: asset });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/assets/:id/checkout — take custody of an item (wardboy taking a
// wheelchair to a ward, IT taking a laptop to a department, etc.)
exports.checkout = async (req, res) => {
  try {
    const { location, note } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    if (asset.status === 'in_use' && asset.assignedTo) {
      return res.status(400).json({ success: false, error: `Already checked out${asset.assignedTo ? '' : ''} — return it before checking out again` });
    }
    asset.status = 'in_use';
    asset.assignedTo = req.user.id;
    asset.assignedNote = note?.trim() || '';
    if (location) asset.currentLocation = location.trim();
    asset.lastUpdatedBy = req.user.id;
    await asset.save();
    res.json({ success: true, data: asset });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/assets/:id/checkin — return it to available/store
exports.checkin = async (req, res) => {
  try {
    const { location } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    asset.status = 'available';
    asset.assignedTo = null;
    asset.assignedNote = '';
    if (location) asset.currentLocation = location.trim();
    asset.lastUpdatedBy = req.user.id;
    await asset.save();
    res.json({ success: true, data: asset });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/assets/:id/service — log a completed service/preventive maintenance visit
exports.markServiced = async (req, res) => {
  try {
    const { nextServiceDue, notes } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    asset.lastServicedAt = new Date();
    asset.nextServiceDue = nextServiceDue ? new Date(nextServiceDue) : new Date(Date.now() + 90*24*60*60*1000); // default 90-day cycle
    asset.status = 'available';
    if (notes) asset.notes = notes.trim();
    asset.lastUpdatedBy = req.user.id;
    await asset.save();
    res.json({ success: true, data: asset });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Asset.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Asset removed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
