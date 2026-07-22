const MaintenanceRequest = require('../models/MaintenanceRequest');
const User = require('../models/User');
const { notify } = require('../utils/notify');

// One trade role per category — used to fan the notification out to
// everyone qualified to pick it up.
const CATEGORY_ROLES = {
  electrical: ['electrician'],
  plumbing:   ['plumber'],
  biomedical: ['equipment_tech', 'biomedical'],
  it:         ['it_technician'],
  general:    ['electrician', 'plumber', 'equipment_tech', 'biomedical', 'it_technician'],
};

// POST /api/maintenance-requests — any staff member reports a facility issue
exports.create = async (req, res) => {
  try {
    const { category, location, description, priority } = req.body;
    if (!category || !location?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, error: 'Category, location, and description are required' });
    }
    const request = await MaintenanceRequest.create({
      category, location: location.trim(), description: description.trim(),
      priority: priority || 'medium', reportedBy: req.user.id,
    });
    await request.populate('reportedBy', 'name role');

    const roles = CATEGORY_ROLES[category] || CATEGORY_ROLES.general;
    const techs = await User.find({ role: { $in: roles }, status: 'approved' }).select('_id');
    await Promise.all(techs.map(t => notify(req, t._id, {
      type: 'maintenance_requested', title: `🛠️ New ${category} request — ${location.trim()}`,
      message: description.trim(), link: '/staff-dashboard', icon: '🛠️',
    })));

    const io = req.app.get('io');
    if (io) io.emit('maintenance_request_created', { requestId: request._id, category, location: request.location });

    res.status(201).json({ success: true, data: request });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/maintenance-requests?category=plumbing — a technician's queue
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.category) q.category = req.query.category;
    if (req.query.status) q.status = req.query.status;
    const requests = await MaintenanceRequest.find(q)
      .populate('reportedBy', 'name role')
      .populate('assignedTo', 'name')
      .sort({ status: 1, priority: -1, createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/maintenance-requests/:id/claim — a technician takes ownership
exports.claim = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ success: false, error: 'This request has already been claimed' });
    request.status = 'claimed';
    request.assignedTo = req.user.id;
    await request.save();
    res.json({ success: true, data: request });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/maintenance-requests/:id/resolve
exports.resolve = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id).populate('reportedBy', 'name');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    request.status = 'resolved';
    request.resolutionNotes = req.body.resolutionNotes?.trim() || '';
    request.resolvedAt = new Date();
    await request.save();

    await notify(req, request.reportedBy._id, { type:'maintenance_resolved', title:'✅ Your maintenance request is resolved', message:`${request.location}: ${request.description}`, link:'/dashboard', icon:'✅' });

    res.json({ success: true, data: request });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
