const AppointmentWaitlist = require('../models/AppointmentWaitlist');
const { notify } = require('../utils/notify');

// POST /api/appointments/waitlist — patient joins the waitlist for a
// fully-booked doctor/date
exports.join = async (req, res) => {
  try {
    const { doctorId, date, notes } = req.body;
    if (!doctorId || !date) return res.status(400).json({ success: false, error: 'Doctor and date are required' });

    const parts = date.split('-').map(Number);
    const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);

    const existing = await AppointmentWaitlist.findOne({ patient: req.user.id, doctor: doctorId, date: dayStart, status: { $in: ['waiting', 'notified'] } });
    if (existing) return res.status(400).json({ success: false, error: 'You\u2019re already on the waitlist for this doctor and date' });

    const entry = await AppointmentWaitlist.create({ patient: req.user.id, doctor: doctorId, date: dayStart, notes: notes?.trim() || '' });
    res.status(201).json({ success: true, data: entry, message: 'You\u2019ve been added to the waitlist — we\u2019ll notify you the moment a slot opens up.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/appointments/waitlist/mine
exports.getMine = async (req, res) => {
  try {
    const entries = await AppointmentWaitlist.find({ patient: req.user.id, status: { $in: ['waiting', 'notified'] } })
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/appointments/waitlist/:id — patient leaves the waitlist
exports.leave = async (req, res) => {
  try {
    const entry = await AppointmentWaitlist.findOneAndUpdate({ _id: req.params.id, patient: req.user.id }, { status: 'cancelled' }, { new: true });
    if (!entry) return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    res.json({ success: true, message: 'Removed from waitlist' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// Called from cancelAppointment when a doctor/date slot frees up —
// notifies everyone waiting for that doctor on that day, in the order
// they joined. Whoever books first through the normal flow gets it; the
// rest stay on the list in case another slot opens too.
exports.notifyWaitlistForSlot = async (req, doctorId, date, freedTimeSlot) => {
  try {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const waiting = await AppointmentWaitlist.find({ doctor: doctorId, date: { $gte: dayStart, $lte: dayEnd }, status: 'waiting' })
      .populate('doctor', 'name')
      .sort({ createdAt: 1 });

    await Promise.all(waiting.map(async entry => {
      entry.status = 'notified';
      entry.notifiedAt = new Date();
      await entry.save();
      await notify(req, entry.patient, {
        type: 'waitlist_slot_open', title: '🎉 A slot just opened up!',
        message: `Dr. ${entry.doctor.name} has a free slot (${freedTimeSlot}) on ${dayStart.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })} — book now before it's gone`,
        link: '/appointments', icon: '🎉',
      });
    }));
  } catch (e) { console.error('notifyWaitlistForSlot failed:', e.message); }
};
