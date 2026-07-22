const MedicationSchedule = require('../models/MedicationSchedule');
const MedicationLog = require('../models/MedicationLog');
const User = require('../models/User');
const { notify } = require('../utils/notify');

const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);

// POST /api/medications/schedules — doctor/nurse/admin starts a patient on a medication
exports.createSchedule = async (req, res) => {
  try {
    const { patientId, medicineName, dosage, route, frequency, startDate, endDate, notes, assignedNurse } = req.body;
    const missing = ['patientId','medicineName','dosage','frequency'].filter(k => !req.body[k]);
    if (missing.length) return res.status(400).json({ success: false, error: `Please fill in: ${missing.join(', ')}` });

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') return res.status(404).json({ success: false, error: 'Patient not found' });

    const schedule = await MedicationSchedule.create({
      patient: patientId, medicineName, dosage, route: route || 'oral', frequency,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      notes: notes || '', prescribedBy: req.user.id,
      assignedNurse: assignedNurse || undefined,
    });
    await schedule.populate('assignedNurse', 'name');

    if (assignedNurse) {
      const io = req.app.get('io');
      if (io) io.to(`user_${assignedNurse}`).emit('medication_assigned', {
        scheduleId: schedule._id, patientName: patient.name, medicineName, dosage,
        assignedBy: req.user.name,
      });
      await notify(req, assignedNurse, { type:'medication_assigned', title:'New medication to administer', message:`${req.user.name} assigned ${medicineName} (${dosage}) for ${patient.name}`, link:'/staff-dashboard', icon:'💊' });
    }

    res.status(201).json({ success: true, data: schedule });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/medications/schedules/:patientId — all schedules (active + past) for one patient
exports.getPatientSchedules = async (req, res) => {
  try {
    const schedules = await MedicationSchedule.find({ patient: req.params.patientId })
      .populate('prescribedBy', 'name').populate('assignedNurse', 'name').sort({ active: -1, createdAt: -1 });
    res.json({ success: true, data: schedules });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/medications/schedules/:id/discontinue
exports.discontinueSchedule = async (req, res) => {
  try {
    const schedule = await MedicationSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
    schedule.active = false;
    schedule.discontinuedAt = new Date();
    schedule.discontinuedBy = req.user.id;
    await schedule.save();
    res.json({ success: true, data: schedule });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/medications/today — every active schedule's dose(s) due today,
// merged with whatever's already been logged, for the nurse's MAR view.
exports.getTodayDue = async (req, res) => {
  try {
    const today = todayStr();
    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

    const schedules = await MedicationSchedule.find({
      active: true, startDate: { $lte: endOfDay },
      $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: startOfDay } }],
    }).populate('patient', 'name').populate('prescribedBy', 'name').populate('assignedNurse', 'name');

    const scheduleIds = schedules.map(s => s._id);
    const todaysLogs = await MedicationLog.find({ schedule: { $in: scheduleIds }, scheduledDate: today });
    const logMap = new Map(todaysLogs.map(l => [`${l.schedule}_${l.doseTime}`, l]));

    const doses = [];
    for (const s of schedules) {
      const times = s.getDoseTimesForToday();
      if (times.length === 0) {
        // PRN (as-needed) — always shown as a standing option, not tied to a specific time
        const log = logMap.get(`${s._id}_PRN`);
        doses.push({
          scheduleId: s._id, patient: s.patient, medicineName: s.medicineName, dosage: s.dosage,
          route: s.route, doseTime: 'PRN', prescribedBy: s.prescribedBy, assignedNurse: s.assignedNurse, notes: s.notes,
          status: log?.status || 'pending', isPRN: true,
        });
        continue;
      }
      for (const t of times) {
        const log = logMap.get(`${s._id}_${t}`);
        const [h, m] = t.split(':').map(Number);
        const dueAt = new Date(); dueAt.setHours(h, m, 0, 0);
        const overdue = !log && now.getTime() > dueAt.getTime() + 30 * 60000; // 30 min grace period
        doses.push({
          scheduleId: s._id, patient: s.patient, medicineName: s.medicineName, dosage: s.dosage,
          route: s.route, doseTime: t, dueAt, prescribedBy: s.prescribedBy, assignedNurse: s.assignedNurse, notes: s.notes,
          status: log?.status || (overdue ? 'overdue' : 'pending'),
        });
      }
    }
    doses.sort((a, b) => (a.doseTime === 'PRN' ? 1 : 0) - (b.doseTime === 'PRN' ? 1 : 0) || (a.doseTime || '').localeCompare(b.doseTime || ''));

    res.json({ success: true, data: doses });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/medications/log — nurse marks a dose given / missed / refused
exports.logDose = async (req, res) => {
  try {
    const { scheduleId, doseTime, status, notes } = req.body;
    if (!scheduleId || !doseTime || !['given','missed','refused'].includes(status)) {
      return res.status(400).json({ success: false, error: 'scheduleId, doseTime, and a valid status are required' });
    }
    const schedule = await MedicationSchedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, error: 'Medication schedule not found' });

    const log = await MedicationLog.findOneAndUpdate(
      { schedule: scheduleId, scheduledDate: todayStr(), doseTime },
      { patient: schedule.patient, status, administeredBy: req.user.id, administeredAt: new Date(), notes: notes || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: log });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
