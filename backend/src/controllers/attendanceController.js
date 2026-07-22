const Attendance = require('../models/Attendance');
const Schedule   = require('../models/Schedule');
const Leave      = require('../models/Leave');
const FaceProfile = require('../models/FaceProfile');
const LateRequest = require('../models/LateRequest');
const { notify } = require('../utils/notify');

const GRACE_MINUTES = 5; // arriving more than 5 min after shift start counts as "late" (e.g. 9:00 shift → late after 9:05)
const LATE_FINE = 50; // ₹ deducted per unwaived late day when salary is generated
const FACE_MATCH_THRESHOLD = 0.5; // face-api.js convention: euclidean distance below this = same person

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Verifies a submitted face descriptor against the caller's enrolled
// profile. Returns { ok: true } or { ok: false, error }. Face verification
// is a SECOND factor on top of being logged in already — it stops someone
// from clocking in on a colleague's borrowed session, it doesn't replace
// authentication.
async function verifyFace(userId, descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return { ok: false, error: 'Invalid face data captured — please try again' };
  }
  const profile = await FaceProfile.findOne({ user: userId });
  if (!profile) return { ok: false, error: 'No enrolled face found for your account — enroll your face first, or use manual check-in.' };
  const distance = euclideanDistance(profile.descriptor, descriptor);
  if (distance > FACE_MATCH_THRESHOLD) {
    return { ok: false, error: "Face didn't match your enrolled profile. Make sure you're well-lit and facing the camera, or use manual check-in.", distance };
  }
  return { ok: true, distance };
}

function dayBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Find today's (or given date's) scheduled shift for a user, if any.
async function findTodaysSchedule(userId, date) {
  const { start, end } = dayBounds(date);
  return Schedule.findOne({ user: userId, date: { $gte: start, $lte: end } });
}

// POST /api/attendance/check-in
exports.checkIn = async (req, res) => {
  try {
    const { lat, lng, faceDescriptor } = req.body;
    const now = new Date();
    const { start, end } = dayBounds(now);

    let existing = await Attendance.findOne({ user: req.user.id, date: start });
    if (existing?.checkInTime) return res.status(400).json({ success: false, error: 'You have already checked in today' });

    // Optional geofencing — same pattern as patient entry check-in. Only
    // enforced if the hospital's coordinates are configured; otherwise
    // manual check-in is always allowed.
    let method = 'manual';

    if (faceDescriptor) {
      const result = await verifyFace(req.user.id, faceDescriptor);
      if (!result.ok) return res.status(400).json({ success: false, error: result.error, faceMismatch: true });
      method = 'face';
    } else {
      const { HOSPITAL_LAT, HOSPITAL_LNG, CHECKIN_RADIUS_METERS } = process.env;
      if (lat !== undefined && lng !== undefined && HOSPITAL_LAT && HOSPITAL_LNG) {
        const radius = Number(CHECKIN_RADIUS_METERS) || 300;
        const dist = distanceMeters(Number(HOSPITAL_LAT), Number(HOSPITAL_LNG), Number(lat), Number(lng));
        if (dist > radius) {
          return res.status(400).json({ success: false, error: `You're ${Math.round(dist)}m from the hospital — get within ${radius}m to check in from here, or ask a supervisor for manual check-in.`, distance: Math.round(dist) });
        }
        method = 'geofence';
      }
    }

    const schedule = await findTodaysSchedule(req.user.id, now);
    let status = 'present', lateByMinutes = 0, scheduledStart = '';
    if (schedule?.startTime) {
      scheduledStart = schedule.startTime;
      const [h, m] = schedule.startTime.split(':').map(Number);
      const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const diffMin = Math.round((now - shiftStart) / 60000);
      if (diffMin > GRACE_MINUTES) { status = 'late'; lateByMinutes = diffMin; }
    }

    if (existing) {
      existing.checkInTime = now; existing.checkInMethod = method; existing.status = status;
      existing.lateByMinutes = lateByMinutes; existing.scheduledStart = scheduledStart; existing.schedule = schedule?._id || null;
      await existing.save();
    } else {
      existing = await Attendance.create({
        user: req.user.id, date: start, schedule: schedule?._id || null,
        checkInTime: now, checkInMethod: method, status, lateByMinutes, scheduledStart,
      });
    }

    res.json({
      success: true, data: existing,
      message: status === 'late'
        ? `Checked in — ${lateByMinutes} min late for your ${scheduledStart} shift.`
        : 'Checked in — have a great shift!',
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/attendance/check-out
exports.checkOut = async (req, res) => {
  try {
    const { lat, faceDescriptor } = req.body || {};
    const now = new Date();
    const { start } = dayBounds(now);
    const record = await Attendance.findOne({ user: req.user.id, date: start });
    if (!record || !record.checkInTime) return res.status(400).json({ success: false, error: "You haven't checked in today yet" });
    if (record.checkOutTime) return res.status(400).json({ success: false, error: 'Already checked out for today' });

    let method = lat !== undefined ? 'geofence' : 'manual';
    if (faceDescriptor) {
      const result = await verifyFace(req.user.id, faceDescriptor);
      if (!result.ok) return res.status(400).json({ success: false, error: result.error, faceMismatch: true });
      method = 'face';
    }

    record.checkOutTime = now;
    record.checkOutMethod = method;
    record.workedMinutes = Math.round((now - record.checkInTime) / 60000);
    if (record.workedMinutes < 240 && record.status !== 'late') record.status = 'half_day'; // < 4 hrs worked
    await record.save();

    res.json({ success: true, data: record, message: `Checked out — ${(record.workedMinutes/60).toFixed(1)} hrs worked today.` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/attendance/face/enroll — save (or replace) the caller's enrolled face descriptor
exports.enrollFace = async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ success: false, error: 'Invalid face descriptor — please recapture and try again' });
    }

    // One face, one account — check this face isn't already enrolled under
    // a DIFFERENT user before allowing enrollment (prevents one person
    // registering under two staff logins, or borrowing a colleague's face).
    const others = await FaceProfile.find({ user: { $ne: req.user.id } }).populate('user', 'name');
    for (const other of others) {
      const distance = euclideanDistance(other.descriptor, descriptor);
      if (distance <= FACE_MATCH_THRESHOLD) {
        return res.status(400).json({
          success: false,
          error: `This face is already enrolled under another account (${other.user?.name || 'another user'}). Each person can only enroll their face once. If this is a mistake, ask an admin to check.`,
          duplicateFace: true,
        });
      }
    }

    const profile = await FaceProfile.findOneAndUpdate(
      { user: req.user.id },
      { user: req.user.id, descriptor, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: { enrolled: true, enrolledAt: profile.enrolledAt }, message: '✅ Face enrolled — you can now use face check-in/out' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/attendance/face/status
exports.getFaceStatus = async (req, res) => {
  try {
    const profile = await FaceProfile.findOne({ user: req.user.id }).select('enrolledAt updatedAt');
    res.json({ success: true, data: { enrolled: !!profile, enrolledAt: profile?.enrolledAt || null, updatedAt: profile?.updatedAt || null } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/attendance/face — remove enrollment (e.g. to re-enroll from scratch)
exports.deleteFaceProfile = async (req, res) => {
  try {
    await FaceProfile.findOneAndDelete({ user: req.user.id });
    res.json({ success: true, message: 'Face enrollment removed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/attendance/mine?month=2026-07 — my attendance for a given month (defaults to current)
exports.getMine = async (req, res) => {
  try {
    const monthStr = req.query.month; // "YYYY-MM"
    const now = new Date();
    const [y, m] = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr.split('-').map(Number) : [now.getFullYear(), now.getMonth()+1];
    const start = new Date(y, m-1, 1, 0,0,0,0);
    const end   = new Date(y, m, 0, 23,59,59,999);

    const records = await Attendance.find({ user: req.user.id, date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const today = await Attendance.findOne({ user: req.user.id, date: dayBounds(now).start });

    const summary = records.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      acc.totalWorkedMinutes += r.workedMinutes || 0;
      return acc;
    }, { present: 0, late: 0, half_day: 0, on_leave: 0, absent: 0, totalWorkedMinutes: 0 });

    res.json({ success: true, data: { records, summary, today } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/attendance?date=YYYY-MM-DD or ?userId=&from=&to= — HR/admin view.
// Smart bit: for any scheduled shift with no attendance record on a PAST
// date, we compute an "absent" (or "on_leave" if an approved leave covers
// it) row on the fly rather than requiring a nightly batch job.
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.userId) q.user = req.query.userId;
    const dateFilter = {};
    if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const p = req.query.date.split('-').map(Number);
      dateFilter.$gte = new Date(p[0],p[1]-1,p[2],0,0,0,0);
      dateFilter.$lte = new Date(p[0],p[1]-1,p[2],23,59,59,999);
    } else {
      dateFilter.$gte = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30*24*60*60*1000);
      dateFilter.$lte = req.query.to ? new Date(req.query.to) : new Date();
    }
    q.date = dateFilter;

    const records = (await Attendance.find(q).populate('user', 'name role department').sort({ date: -1 }))
      .filter(r => r.user); // drop any record whose user was since deleted, rather than crashing on it

    let gapRows = [];
    try {
      // Fill in computed "absent"/"on_leave" rows for scheduled shifts with
      // no matching attendance record, on past dates only. Wrapped in its
      // own try/catch so if anything here goes wrong, HR still gets the
      // real attendance records back instead of a blank error.
      const scheduleQuery = { date: dateFilter };
      if (req.query.userId) scheduleQuery.user = req.query.userId;
      const schedules = (await Schedule.find(scheduleQuery).populate('user', 'name role department'))
        .filter(s => s.user); // dangling refs get skipped, not crashed on

      const haveRecord = new Set(records.map(r => `${r.user._id}_${new Date(r.date).toDateString()}`));
      const now = new Date();
      const todayStart = dayBounds(now).start;
      const pastSchedules = schedules.filter(s => new Date(s.date) < todayStart);

      // Batch-fetch all approved leaves touching this date range once,
      // instead of one query per schedule row.
      const approvedLeaves = await Leave.find({
        status: 'approved',
        from: { $lte: dateFilter.$lte },
        to:   { $gte: dateFilter.$gte },
      });
      const isOnLeave = (userId, date) => approvedLeaves.some(l =>
        String(l.user) === String(userId) && new Date(l.from) <= date && new Date(l.to) >= date
      );

      for (const s of pastSchedules) {
        const key = `${s.user._id}_${new Date(s.date).toDateString()}`;
        if (haveRecord.has(key)) continue;
        gapRows.push({
          _id: `computed_${s._id}`, user: s.user, date: s.date, schedule: s._id,
          checkInTime: null, checkOutTime: null, status: isOnLeave(s.user._id, s.date) ? 'on_leave' : 'absent',
          computed: true,
        });
      }
    } catch (gapErr) {
      console.error('Attendance gap-fill computation failed (returning raw records only):', gapErr.message);
      gapRows = [];
    }

    const all = [...records, ...gapRows].sort((a,b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, count: all.length, data: all });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/attendance/:id/mark — HR override (e.g. mark on_leave, correct a mistaken entry)
exports.manualOverride = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['present','late','half_day','on_leave','absent'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Attendance record not found' });
    record.status = status;
    if (notes !== undefined) record.notes = notes;
    await record.save();
    res.json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── LATE-REPORTING APPEALS ──────────────────────────────────────────────

// POST /api/attendance/late-request — staff appeals a "late" mark on a
// specific day, giving a reason (traffic, emergency, pre-approved late
// start, etc.) for admin to review.
exports.submitLateRequest = async (req, res) => {
  try {
    const { attendanceId, reason } = req.body;
    if (!attendanceId || !reason?.trim()) return res.status(400).json({ success: false, error: 'Attendance record and a reason are required' });

    const record = await Attendance.findById(attendanceId);
    if (!record) return res.status(404).json({ success: false, error: 'Attendance record not found' });
    if (String(record.user) !== String(req.user.id)) return res.status(403).json({ success: false, error: 'Not authorized' });
    if (record.status !== 'late') return res.status(400).json({ success: false, error: 'This day is not marked as late' });
    if (record.lateWaived) return res.status(400).json({ success: false, error: 'This late mark has already been waived' });

    const existing = await LateRequest.findOne({ attendance: attendanceId });
    if (existing) {
      if (existing.status === 'pending') return res.status(400).json({ success: false, error: 'You already have a pending request for this day' });
      if (existing.status === 'approved') return res.status(400).json({ success: false, error: 'This day has already been approved' });
      // Rejected before — allow resubmitting with a fresh reason
      existing.reason = reason.trim(); existing.status = 'pending'; existing.reviewedBy = null; existing.reviewedAt = null; existing.adminNote = '';
      await existing.save();
      await existing.populate('user', 'name role');
      return res.status(201).json({ success: true, data: existing });
    }

    const request = await LateRequest.create({ user: req.user.id, attendance: attendanceId, date: record.date, reason: reason.trim() });
    await request.populate('user', 'name role');

    const admins = await require('../models/User').find({ role: { $in: ['admin', 'finance'] }, status: 'approved' }).select('_id');
    for (const a of admins) {
      await notify(req, a._id, {
        type: 'late_request', title: '⏰ Late-reporting request',
        message: `${req.user.name} is appealing a late mark on ${new Date(record.date).toLocaleDateString('en-IN')}`,
        link: '/attendance', icon: '⏰',
      });
    }

    res.status(201).json({ success: true, data: request });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/attendance/late-requests?status= — admin sees all, staff sees their own
exports.getLateRequests = async (req, res) => {
  try {
    const q = {};
    if (!['admin', 'finance'].includes(req.user.role)) q.user = req.user.id;
    if (req.query.status) q.status = req.query.status;
    const requests = await LateRequest.find(q).populate('user', 'name role department').populate('attendance', 'date checkInTime scheduledStart lateByMinutes').populate('reviewedBy', 'name').sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/attendance/late-requests/:id/decide — admin approves or rejects
exports.decideLateRequest = async (req, res) => {
  try {
    const { decision, adminNote } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ success: false, error: 'Invalid decision' });

    const request = await LateRequest.findById(req.params.id).populate('user', 'name');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: `This request is already ${request.status}` });

    request.status = decision === 'approve' ? 'approved' : 'rejected';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.adminNote = adminNote?.trim() || '';
    await request.save();

    if (decision === 'approve') {
      await Attendance.findByIdAndUpdate(request.attendance, { status: 'present', lateWaived: true });
    }

    await notify(req, request.user._id, {
      type: 'late_request_decided', title: decision === 'approve' ? '✅ Late request approved' : '✕ Late request rejected',
      message: decision === 'approve'
        ? `Your late mark on ${new Date(request.date).toLocaleDateString('en-IN')} has been waived — no fine will apply.`
        : `Your late-reporting request for ${new Date(request.date).toLocaleDateString('en-IN')} was rejected.${request.adminNote ? ' ' + request.adminNote : ''}`,
      link: '/attendance', icon: decision === 'approve' ? '✅' : '✕',
    });

    res.json({ success: true, data: request });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
