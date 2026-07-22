const DoctorCabin = require('../models/DoctorCabin');
const User = require('../models/User');
const { logAction } = require('../utils/auditLog');

// GET /api/doctor-cabins — admin sees the full seating layout; doctors see only their own
exports.getCabins = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'doctor') q.doctor = req.user.id;
    else if (req.query.doctorId) q.doctor = req.query.doctorId;
    const cabins = await DoctorCabin.find(q).populate('doctor', 'name specialization department avatar');
    res.json({ success: true, count: cabins.length, data: cabins });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/doctor-cabins/by-doctor/:doctorId — used right after appointment booking,
// and by anyone who needs to know where a specific doctor sits
exports.getCabinForDoctor = async (req, res) => {
  try {
    const cabin = await DoctorCabin.findOne({ doctor: req.params.doctorId }).populate('doctor', 'name specialization department');
    if (!cabin) return res.json({ success: true, data: null }); // not an error — just not assigned yet
    res.json({ success: true, data: cabin });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/doctor-cabins — admin assigns/updates a doctor's seating area
exports.upsertCabin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Only admin can assign seating areas' });
    const { doctorId, cabinNo, floor, building, wing, notes } = req.body;
    if (!doctorId || !cabinNo) return res.status(400).json({ success: false, error: 'doctorId and cabinNo are required' });

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    const existed = await DoctorCabin.findOne({ doctor: doctorId });

    const cabin = await DoctorCabin.findOneAndUpdate(
      { doctor: doctorId },
      { cabinNo, floor, building, wing, notes },
      { new: true, upsert: true, runValidators: true }
    ).populate('doctor', 'name specialization department');

    // Flag it clearly in the log if this cabin number was shared with
    // another doctor at the time of assignment — mirrors the warning
    // shown to admin in the UI before they confirmed.
    const conflictingDoctor = await DoctorCabin.findOne({ cabinNo, doctor: { $ne: doctorId } }).populate('doctor', 'name');
    logAction({
      actor: req.user, action: 'room_assigned',
      description: `${existed ? 'Reassigned' : 'Assigned'} cabin ${cabinNo} to Dr. ${doctor.name}` +
        (conflictingDoctor ? ` (also used by Dr. ${conflictingDoctor.doctor?.name})` : ''),
      targetType: 'DoctorCabin', targetId: cabin._id,
    });

    res.json({ success: true, data: cabin });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/doctor-cabins/:id
exports.deleteCabin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Only admin can remove a seating assignment' });
    await DoctorCabin.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
