const AmbulanceTrip = require('../models/AmbulanceTrip');
const User = require('../models/User');
const smsService = require('../utils/smsService');
const { notify } = require('../utils/notify');

// GET /api/ambulance-trips — today's trips for the logged-in driver (or all, for admin)
exports.getTrips = async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay   = new Date(); endOfDay.setHours(23,59,59,999);
    const q = { date: { $gte: startOfDay, $lte: endOfDay } };
    if (req.user.role === 'ambulance_driver') {
      // A driver sees their own assigned/logged trips, PLUS the open
      // request queue (not yet accepted by anyone) so they can pick one up.
      q.$or = [{ driver: req.user.id }, { status: 'requested', driver: { $exists: false } }];
    } else if (['admin','receptionist'].includes(req.user.role)) {
      // Front desk needs visibility into all of today's ambulance activity
      // to coordinate with patients/families waiting on one — read-only,
      // they don't accept or progress trips themselves.
      if (req.query.driverId) q.driver = req.query.driverId;
    } else {
      q.driver = req.user.id;
    }

    const trips = await AmbulanceTrip.find(q).populate('driver','name phone').populate('requestedBy','name phone').sort({ scheduledTime: 1, createdAt: 1 });
    res.json({ success: true, count: trips.length, data: trips });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/ambulance-trips — driver logs a trip themselves (or admin/receptionist dispatches one)
exports.createTrip = async (req, res) => {
  try {
    const { from, to, purpose, patientName, scheduledTime, driverId, notes } = req.body;
    if (!from || !to) return res.status(400).json({ success: false, error: 'Pickup (from) and destination (to) are required' });

    const driver = ['admin','receptionist'].includes(req.user.role) && driverId ? driverId : req.user.id;
    const trip = await AmbulanceTrip.create({ driver, from, to, purpose, patientName, scheduledTime, notes });
    await trip.populate('driver','name');
    res.status(201).json({ success: true, data: trip });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/ambulance-trips/:id — mark complete/cancelled, or edit details
exports.updateTrip = async (req, res) => {
  try {
    const trip = await AmbulanceTrip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    if (req.user.role !== 'admin' && trip.driver?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only update your own trips' });
    }
    const updates = { ...req.body };
    if (updates.status === 'completed' && trip.status !== 'completed') updates.completedAt = new Date();
    Object.assign(trip, updates);
    await trip.save();
    res.json({ success: true, data: trip });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Patient-facing ambulance request flow ──────────────────────────────

// POST /api/ambulance-trips/request — a patient requests pickup
exports.requestAmbulance = async (req, res) => {
  try {
    const { from, to, purpose, contactPhone, isEmergency } = req.body;
    if (!from || !from.trim()) return res.status(400).json({ success: false, error: 'Pickup location is required' });

    const trip = await AmbulanceTrip.create({
      requestedBy: req.user.id,
      patientName: req.user.name,
      contactPhone: contactPhone || req.user.phone || '',
      from: from.trim(),
      to: (to || 'Mediventra').trim(),
      purpose: purpose || '',
      isEmergency: !!isEmergency,
      status: 'requested',
    });

    const io = req.app.get('io');
    // Broadcast to every connected socket — ambulance drivers and
    // admin/receptionist filter for this on the client. There's no
    // single "dispatch room" today, and a hospital-wide alert for an
    // emergency pickup request is exactly the kind of thing that should
    // reach whoever's online rather than risk sitting unseen.
    if (io) io.emit('ambulance_requested', {
      tripId: trip._id, patientName: trip.patientName, from: trip.from, to: trip.to,
      isEmergency: trip.isEmergency, requestedAt: trip.createdAt,
    });

    res.status(201).json({ success: true, data: trip, message: 'Ambulance requested — hospital staff have been notified.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/ambulance-trips/mine — a patient's own requests
exports.getMyRequests = async (req, res) => {
  try {
    const trips = await AmbulanceTrip.find({ requestedBy: req.user.id }).populate('driver','name phone').sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: trips });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/ambulance-trips/:id/accept — a driver picks up an open request
exports.acceptRequest = async (req, res) => {
  try {
    // Atomic find-and-update guards against two drivers accepting the
    // same request at the same moment — only the first one wins.
    const trip = await AmbulanceTrip.findOneAndUpdate(
      { _id: req.params.id, status: 'requested' },
      { driver: req.user.id, status: 'dispatched', dispatchedAt: new Date() },
      { new: true }
    ).populate('driver', 'name phone').populate('requestedBy', 'name phone');

    if (!trip) return res.status(409).json({ success: false, error: 'This request was already picked up by another driver, or no longer exists.' });

    const io = req.app.get('io');
    if (io && trip.requestedBy) {
      io.to(`user_${trip.requestedBy._id}`).emit('ambulance_dispatched', {
        tripId: trip._id, driverName: trip.driver.name, driverPhone: trip.driver.phone,
      });
      io.emit('ambulance_trip_updated', { tripId: trip._id, status: 'dispatched' });
      await notify(req, trip.requestedBy._id, { type:'ambulance_dispatched', title:'🚑 Ambulance dispatched', message:`${trip.driver.name} is on the way (${trip.driver.phone})`, link:'/ambulance', icon:'🚑' });
    }
    if (trip.contactPhone) {
      smsService.sendSMS({
        to: trip.contactPhone,
        body: `Mediventra: An ambulance has been dispatched to you. Driver: ${trip.driver.name}${trip.driver.phone ? ` (${trip.driver.phone})` : ''}. Help is on the way.`,
      }).catch(console.error);
    }

    res.json({ success: true, data: trip });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/ambulance-trips/:id/progress — driver updates en_route/arrived/completed/cancelled
exports.updateProgress = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const allowed = ['en_route', 'arrived', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const trip = await AmbulanceTrip.findById(req.params.id).populate('requestedBy', 'name phone');
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    if (req.user.role !== 'admin' && trip.driver?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only update your own assigned trips' });
    }

    trip.status = status;
    if (status === 'en_route')  trip.enRouteAt   = new Date();
    if (status === 'arrived')   trip.arrivedAt   = new Date();
    if (status === 'completed') trip.completedAt = new Date();
    if (status === 'cancelled') trip.cancelReason = cancelReason || '';
    await trip.save();

    const io = req.app.get('io');
    if (io && trip.requestedBy) {
      io.to(`user_${trip.requestedBy._id}`).emit('ambulance_status_update', { tripId: trip._id, status, cancelReason: trip.cancelReason });
      io.emit('ambulance_trip_updated', { tripId: trip._id, status });
    }

    // Give the receiving floor a heads-up while the ambulance is still on
    // its way, not just after it's already pulled in — nurses/security/
    // reception can have a bed and wheelchair ready by the time it arrives.
    if (status === 'en_route' && /hospital|emergency|er\b/i.test(trip.to || '')) {
      const staff = await User.find({ role: { $in: ['nurse', 'security', 'receptionist'] }, status: 'approved' }).select('_id');
      await Promise.all(staff.map(s => notify(req, s._id, {
        type: 'ambulance_incoming', title: '🚑 Ambulance incoming',
        message: `${trip.patientName || 'Patient'} — ${trip.purpose || 'emergency transport'} — ETA shortly`,
        link: '/dashboard', icon: '🚑',
      })));
    }

    res.json({ success: true, data: trip });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
