const Visitor = require('../models/Visitor');

// POST /api/visitors — security logs a visitor in at the gate
exports.checkIn = async (req, res) => {
  try {
    const { visitorName, phone, purpose, personToMeet, patientToVisit, department, idProofType, idProofNumber, vehicleNumber, badgeNumber, notes } = req.body;
    if (!visitorName?.trim() || !purpose?.trim()) {
      return res.status(400).json({ success: false, error: 'Visitor name and purpose of visit are required' });
    }
    const visitor = await Visitor.create({
      visitorName: visitorName.trim(), phone: phone?.trim() || '', purpose: purpose.trim(),
      personToMeet: personToMeet?.trim() || '', patientToVisit: patientToVisit || null, department: department?.trim() || '',
      idProofType: idProofType || '', idProofNumber: idProofNumber?.trim() || '', vehicleNumber: vehicleNumber?.trim() || '',
      badgeNumber: badgeNumber?.trim() || '', notes: notes?.trim() || '', loggedBy: req.user.id,
    });
    await visitor.populate('loggedBy', 'name');

    const io = req.app.get('io');
    if (io) io.emit('visitor_checked_in', { visitorId: visitor._id, visitorName: visitor.visitorName });

    res.status(201).json({ success: true, data: visitor });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/visitors?status=&date=
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const p = req.query.date.split('-').map(Number);
      q.entryTime = { $gte: new Date(p[0],p[1]-1,p[2],0,0,0,0), $lte: new Date(p[0],p[1]-1,p[2],23,59,59,999) };
    } else if (!req.query.all) {
      // Default: today only, so the gate register doesn't grow unbounded on screen
      const now = new Date();
      q.entryTime = { $gte: new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0), $lte: new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999) };
    }
    const visitors = await Visitor.find(q).populate('loggedBy', 'name').populate('checkedOutBy', 'name').populate('patientToVisit', 'name').sort({ entryTime: -1 });
    res.json({ success: true, count: visitors.length, data: visitors });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/visitors/:id/checkout
exports.checkOut = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return res.status(404).json({ success: false, error: 'Visitor entry not found' });
    if (visitor.status === 'checked_out') return res.status(400).json({ success: false, error: 'Already checked out' });
    visitor.status = 'checked_out';
    visitor.exitTime = new Date();
    visitor.checkedOutBy = req.user.id;
    await visitor.save();

    const io = req.app.get('io');
    if (io) io.emit('visitor_checked_out', { visitorId: visitor._id, visitorName: visitor.visitorName });

    res.json({ success: true, data: visitor });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
