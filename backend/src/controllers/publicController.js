const User = require('../models/User');
const OTRoom = require('../models/OTRoom');
const Review = require('../models/Review');
const HospitalConfig = require('../models/HospitalConfig');

// GET /api/public/hospital-info — name, tagline, and contact details for
// the marketing homepage. Only the fields that are meant to be public;
// signatory/signature fields are left out.
exports.getPublicHospitalInfo = async (req, res) => {
  try {
    const config = await HospitalConfig.findOne();
    res.json({
      success: true,
      data: {
        hospitalName: config?.hospitalName || 'Mediventra',
        tagline: config?.tagline || 'Compassionate Care, Modern Medicine',
        contactPhone: config?.contactPhone || '',
        contactEmail: config?.contactEmail || '',
        address: config?.address || '',
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/public/doctors — approved doctors for the public landing page.
// Deliberately minimal fields (no email/phone/internal IDs) since this is
// unauthenticated.
exports.getPublicDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', status: 'approved' })
      .select('name specialization department rating avatar')
      .sort({ rating: -1 })
      .limit(12);
    res.json({ success: true, data: doctors });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/public/stats — real, honestly-computed headline numbers for the
// homepage stat strip. Never fabricated: if there's no review data yet,
// satisfactionPct comes back null and the frontend should hide that stat
// rather than invent a number.
exports.getPublicStats = async (req, res) => {
  try {
    const [doctorCount, patientCount, rooms, reviewAgg] = await Promise.all([
      User.countDocuments({ role: 'doctor', status: 'approved' }),
      User.countDocuments({ role: 'patient', status: 'approved' }),
      OTRoom.find().select('capacity'),
      Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    ]);
    const roomCount = rooms.reduce((sum, r) => sum + (r.capacity || 1), 0);
    const satisfactionPct = reviewAgg[0]?.count > 0 ? Math.round((reviewAgg[0].avg / 5) * 100) : null;

    res.json({
      success: true,
      data: { doctorCount, patientCount, roomCount, satisfactionPct, reviewCount: reviewAgg[0]?.count || 0 },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
