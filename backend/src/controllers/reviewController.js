const Review = require('../models/Review');
const Appointment = require('../models/Appointment');

// POST /api/reviews — patient rates a completed appointment. One review per
// appointment; this is the only way a doctor's rating is ever populated —
// there is no fabricated default anywhere in this app anymore.
exports.createReview = async (req, res) => {
  try {
    const { appointmentId, rating, comment } = req.body;
    if (!appointmentId || !rating) return res.status(400).json({ success: false, error: 'appointmentId and rating are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });

    const appt = await Appointment.findById(appointmentId);
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    if (appt.patient.toString() !== req.user.id) return res.status(403).json({ success: false, error: 'You can only rate your own appointments' });
    if (appt.status !== 'completed') return res.status(400).json({ success: false, error: 'You can only rate a completed appointment' });

    const existing = await Review.findOne({ appointment: appointmentId });
    if (existing) return res.status(400).json({ success: false, error: 'You have already rated this appointment' });

    const review = await Review.create({
      appointment: appointmentId, doctor: appt.doctor, patient: req.user.id,
      rating, comment: (comment || '').slice(0, 1000),
    });

    appt.ratingSubmitted = true;
    await appt.save();

    res.status(201).json({ success: true, data: review, message: 'Thank you for your feedback!' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, error: 'You have already rated this appointment' });
    res.status(500).json({ success: false, error: e.message });
  }
};

// GET /api/reviews/doctor/:doctorId — real average rating + recent reviews
exports.getDoctorReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ doctor: req.params.doctorId })
      .populate('patient', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
    res.json({ success: true, count: reviews.length, average: avg ? Math.round(avg * 10) / 10 : null, data: reviews });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/reviews/mine — patient checks which of their completed
// appointments are still awaiting a rating (drives the "Rate your visit"
// prompt on the patient dashboard)
exports.getMyPendingRatings = async (req, res) => {
  try {
    const pending = await Appointment.find({
      patient: req.user.id, status: 'completed', ratingSubmitted: { $ne: true },
    }).populate('doctor', 'name specialization department avatar').sort({ updatedAt: -1 });
    res.json({ success: true, count: pending.length, data: pending });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
