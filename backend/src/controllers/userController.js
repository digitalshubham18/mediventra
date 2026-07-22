
const User = require('../models/User');
const emailService = require('../utils/emailService');
const UserSession = require('../models/UserSession');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const { logAction } = require('../utils/auditLog');

// GET /api/users — admin sees all, others filtered
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.role)   q.role   = req.query.role;
    if (req.query.status) q.status = req.query.status;
    if (req.query.search) {
      q.$or = [
        { name:  { $regex: req.query.search, $options:'i' } },
        { email: { $regex: req.query.search, $options:'i' } },
      ];
    }
    const users = await User.find(q).sort({ createdAt: -1 });

    let data = users;
    if (req.query.role === 'doctor' && users.length) {
      // Real, batch-computed patient counts and ratings — no fabricated
      // numbers shown on doctor cards. One aggregate for the whole list
      // instead of a query per doctor.
      const [counts, ratingAggs] = await Promise.all([
        Appointment.aggregate([
          { $match: { doctor: { $in: users.map(u => u._id) } } },
          { $group: { _id: { doctor: '$doctor', patient: '$patient' } } },
          { $group: { _id: '$_id.doctor', totalPatients: { $sum: 1 } } },
        ]),
        Review.aggregate([
          { $match: { doctor: { $in: users.map(u => u._id) } } },
          { $group: { _id: '$doctor', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
      ]);
      const countMap = new Map(counts.map(c => [c._id.toString(), c.totalPatients]));
      const ratingMap = new Map(ratingAggs.map(r => [r._id.toString(), { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
      data = users.map(u => {
        const obj = u.toObject();
        obj.realStats = { totalPatients: countMap.get(u._id.toString()) || 0 };
        const ratingInfo = ratingMap.get(u._id.toString());
        obj.rating = ratingInfo ? ratingInfo.avg : null;
        obj.reviewCount = ratingInfo ? ratingInfo.count : 0;
        return obj;
      });
    }

    res.json({ success: true, count: data.length, data });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// GET /api/users/online — admin-only live presence list, pulled from the
// in-memory socket map maintained in server.js (app.set('onlineUsers', ...))
exports.getOnlineUsers = async (req, res) => {
  try {
    const onlineMap = req.app.get('onlineUsers'); // Map<userId, { sockets, name, role, lastSeen }>
    const userIds = onlineMap ? [...onlineMap.keys()] : [];
    if (!userIds.length) return res.json({ success: true, count: 0, data: [] });

    const users = await User.find({ _id: { $in: userIds } }).select('name email role department avatar');
    // Most recent session per user — this is what tells admin *where*
    // (roughly) and from what IP each currently-online person logged in.
    const latestSessions = await UserSession.aggregate([
      { $match: { user: { $in: users.map(u => u._id) } } },
      { $sort: { loginAt: -1 } },
      { $group: { _id: '$user', ip: { $first: '$ip' }, location: { $first: '$location' }, loginAt: { $first: '$loginAt' } } },
    ]);
    const sessionMap = new Map(latestSessions.map(s => [s._id.toString(), s]));

    const data = users.map(u => {
      const presence = onlineMap.get(u._id.toString());
      const session = sessionMap.get(u._id.toString());
      return {
        _id: u._id, name: u.name, email: u.email, role: u.role,
        department: u.department, avatar: u.avatar,
        deviceCount: presence?.sockets?.size || 1,
        lastSeen: presence?.lastSeen || new Date(),
        loginIp: session?.ip || '',
        loginLocation: session?.location || null,
      };
    });
    res.json({ success: true, count: data.length, data });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/users/:id
exports.getOne = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:'User not found' });

    const data = user.toObject();
    if (user.role === 'doctor') {
      // Real numbers only — no fabricated "rating: 4.8" or sample patient
      // counts. If there's nothing real to show, the frontend shows an
      // honest empty state instead of made-up data.
      const [distinctPatients, totalAppointments, completedAppointments, reviews] = await Promise.all([
        Appointment.distinct('patient', { doctor: user._id }),
        Appointment.countDocuments({ doctor: user._id }),
        Appointment.countDocuments({ doctor: user._id, status: 'completed' }),
        Review.find({ doctor: user._id }),
      ]);
      data.realStats = {
        totalPatients: distinctPatients.length,
        totalAppointments,
        completedAppointments,
      };
      data.rating = reviews.length ? Math.round((reviews.reduce((s,r)=>s+r.rating,0) / reviews.length) * 10) / 10 : null;
      data.reviewCount = reviews.length;
    }

    res.json({ success:true, data });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// PUT /api/users/:id — admin updates any user
exports.update = async (req, res) => {
  try {
    const allowed = ['name','phone','role','department','specialization','licenseNumber','status','bloodGroup','address','gender','age','bankAccount','joiningDate','notificationPrefs','bio','degrees','experiences','experienceYears'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new:true, runValidators:true });
    if (!user) return res.status(404).json({ success:false, error:'User not found' });
    res.json({ success:true, data:user });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// PUT /api/users/:id/approve
exports.approve = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:'User not found' });
    user.status = 'approved';
    await user.save({ validateBeforeSave: false });

    // Send approval email — documentation instructions only apply to
    // salaried hospital staff (bank details are for salary credit, which
    // patients never receive). Patients get a simpler welcome email.
    const docLink = (process.env.CLIENT_URL || 'http://localhost:3000') + '/settings?tab=profile';
    const isSalariedStaff = user.role !== 'patient';

    const approvalHTML = isSalariedStaff ? `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#059669,#34d399);padding:32px;text-align:center">
  <div style="font-size:48px;margin-bottom:8px">🎉</div>
  <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0">Account Approved!</h1>
  <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">Mediventra Hospital Management System</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 12px">Welcome, ${user.name}! 🏥</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px">Your <strong>${user.role}</strong> account has been approved. You can now login to Mediventra using your registered email and password.</p>
  <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:14px;padding:20px;margin-bottom:24px">
    <h3 style="color:#92400e;font-size:16px;font-weight:800;margin:0 0 12px">📋 Action Required: Complete Your Documentation</h3>
    <p style="color:#92400e;font-size:13px;margin:0 0 10px">Please log in and complete the following in your profile settings:</p>
    <ul style="color:#92400e;font-size:14px;margin:0;padding-left:20px;line-height:2">
      <li><strong>Bank Account Details</strong> — Required for salary credit (account number, IFSC, bank name)</li>
      <li><strong>Emergency Contact</strong> — Name, phone number & relationship</li>
      <li><strong>Permanent Address</strong> — Complete residential address</li>
      <li><strong>Government ID</strong> — Aadhaar / PAN number</li>
      <li><strong>Profile Photo</strong> — Clear recent photograph</li>
      ${user.role === 'doctor' ? '<li><strong>Medical License & Qualifications</strong> — For verification</li>' : ''}
    </ul>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <a href="${docLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px">📝 Complete Documentation →</a>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px">
    <p style="color:#15803d;font-size:13px;margin:0;font-weight:600">⏰ Please complete your documentation within 7 days to activate full system access.</p>
  </div>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>` : `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:32px;text-align:center">
  <div style="font-size:48px;margin-bottom:8px">🎉</div>
  <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0">Account Approved!</h1>
  <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">Mediventra Hospital Management System</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 12px">Welcome, ${user.name}! 🩺</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px">Your patient account has been approved. You can now log in and book appointments, view your medical records, order medicines, and more.</p>
  <div style="text-align:center;margin-bottom:24px">
    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px">🏥 Go to Dashboard →</a>
  </div>
  <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px">
    <p style="color:#6d28d9;font-size:13px;margin:0;font-weight:600">💡 Tip: Keep your profile (phone, blood group, address) up to date for faster check-ins.</p>
  </div>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;

    emailService.sendGeneral({
      to: user.email,
      subject: isSalariedStaff ? '✅ Account Approved — Complete Your Documentation | Mediventra' : '✅ Account Approved — Welcome to Mediventra',
      html: approvalHTML,
    }).catch(console.error);

    // Real-time notification
    const io = req.app.get('io');
    if (io) io.emit('user_approved', { userId: user._id, name: user.name, role: user.role });

    logAction({
      actor: req.user, action: 'user_approved',
      description: `Approved ${user.role} account for "${user.name}"`,
      targetType: 'User', targetId: user._id,
    });

    res.json({ success:true, data:user });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (user) {
      logAction({
        actor: req.user, action: 'user_deleted',
        description: `Deleted ${user.role} account "${user.name}" (${user.email})`,
        targetType: 'User', targetId: user._id,
      });
    }
    res.json({ success:true, message:'User deleted' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// POST /api/users/patients — staff (doctor/nurse/admin) adds a patient
// directly. Unlike public self-registration, this never requires an OTP:
// the patient is standing in front of an already-authenticated staff
// member, so there's nothing left to verify by emailing them a code.
// A random temporary password is generated and emailed to the patient
// (if their email is provided) so they can log in themselves later.
exports.createPatient = async (req, res) => {
  try {
    const { name, email, phone, password, bloodGroup, gender, age, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success:false, error:'Patient name is required' });

    let finalEmail = (email || '').trim().toLowerCase();
    if (finalEmail) {
      const existing = await User.findOne({ email: finalEmail });
      if (existing) return res.status(400).json({ success:false, error:'A patient with this email already exists' });
    } else {
      // Walk-in patients often don't have/want to share an email up
      // front — generate a placeholder so the record can still be
      // created; staff can add the real email later via Edit Patient.
      finalEmail = `patient.${Date.now()}.${Math.random().toString(36).slice(2,7)}@no-email.mediventra.local`;
    }

    const tempPassword = password && password.length >= 6
      ? password
      : Math.random().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(-4);

    const user = await User.create({
      name: name.trim(), email: finalEmail, password: tempPassword,
      role: 'patient', phone, bloodGroup, gender, age, address,
      status: 'approved', emailVerified: true, joiningDate: new Date(),
      createdByStaff: req.user.id,
    });

    // Only attempt to email credentials if a real address was given.
    if (email && email.trim()) {
      emailService.sendGeneral({
        to: finalEmail,
        subject: '👋 Your Mediventra Patient Account',
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#1648c9,#0ea5e9);padding:30px;text-align:center">
  <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0">Welcome to Mediventra</h1>
</td></tr>
<tr><td style="padding:30px">
  <p style="color:#374151;font-size:14px;line-height:1.7">Hi ${user.name}, an account was created for you by our staff. Use these details to log in and access your health records:</p>
  <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin:16px 0">
    <p style="margin:0 0 6px;font-size:13px;color:#64748b">Email: <strong style="color:#0f172a">${finalEmail}</strong></p>
    <p style="margin:0;font-size:13px;color:#64748b">Temporary password: <strong style="color:#0f172a">${tempPassword}</strong></p>
  </div>
  <p style="color:#94a3b8;font-size:12px">Please log in and change your password from Settings as soon as possible.</p>
</td></tr></table></td></tr></table></body></html>`,
      }).catch(console.error);
    }

    res.status(201).json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, role: user.role },
      tempPassword: email && email.trim() ? undefined : tempPassword, // surface it in the UI if we couldn't email it
      message: 'Patient added successfully',
    });

    logAction({
      actor: req.user, action: 'patient_created_by_staff',
      description: `Added patient "${user.name}" directly`,
      targetType: 'User', targetId: user._id,
    });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success:false, error:'A patient with this email already exists' });
    res.status(500).json({ success:false, error:e.message });
  }
};

// GET /api/users/stats
// PUT /api/users/:id/vitals — record real vitals from an actual hospital
// visit. Doctor/nurse/admin only; deliberately separate from the general
// update() above so a patient's own profile edits can never touch this.
exports.updateVitals = async (req, res) => {
  try {
    const patient = await User.findById(req.params.id);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    const { bloodPressure, pulse, temperature, spo2 } = req.body;
    const currentVitals = {
      bloodPressure: bloodPressure ?? patient.currentVitals?.bloodPressure ?? '',
      pulse:       pulse === '' || pulse == null ? patient.currentVitals?.pulse : Number(pulse),
      temperature: temperature === '' || temperature == null ? patient.currentVitals?.temperature : Number(temperature),
      spo2:        spo2 === '' || spo2 == null ? patient.currentVitals?.spo2 : Number(spo2),
      recordedAt: new Date(),
      recordedBy: req.user.id,
      recordedByName: req.user.name,
    };
    patient.currentVitals = currentVitals;
    await patient.save();

    const io = req.app.get('io');
    if (io) io.to(`user_${patient._id}`).emit('vitals_updated', { patientId: patient._id, currentVitals });

    res.json({ success: true, data: patient });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/users/on-duty?role=nurse — who's actually on shift RIGHT NOW,
// not just "has the role". Cross-references today's Schedule entries
// against the current time and each entry's startTime/endTime, so a
// doctor assigning a medication (or anyone assigning cross-role work)
// gets a real, live list instead of guessing from a static staff
// directory. Reusable for any role — nurse, wardboy, receptionist, etc.
exports.getOnDutyStaff = async (req, res) => {
  try {
    const { role } = req.query;
    if (!role) return res.status(400).json({ success: false, error: 'A role is required, e.g. ?role=nurse' });

    const Schedule = require('../models/Schedule');
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

    const todaysShifts = await Schedule.find({
      role, date: { $gte: startOfDay, $lte: endOfDay }, status: 'scheduled',
    }).populate('user', 'name phone email role');

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = (t) => { const [h,m] = (t || '00:00').split(':').map(Number); return h*60 + (m||0); };

    const onDuty = todaysShifts.filter(s => {
      if (!s.user) return false;
      const start = toMinutes(s.startTime), end = toMinutes(s.endTime);
      // Overnight shifts (e.g. 22:00–06:00) wrap past midnight
      return start <= end ? (nowMinutes >= start && nowMinutes <= end) : (nowMinutes >= start || nowMinutes <= end);
    }).map(s => ({ ...s.user.toObject(), shift: s.shift, startTime: s.startTime, endTime: s.endTime }));

    // Fallback: if nobody's shift technically covers this exact minute
    // (common in smaller/demo datasets with loosely-kept shift times),
    // still surface anyone scheduled today for that role rather than
    // leaving the assign-to dropdown completely empty.
    if (onDuty.length === 0) {
      const anyToday = todaysShifts.filter(s => s.user).map(s => ({ ...s.user.toObject(), shift: s.shift, startTime: s.startTime, endTime: s.endTime, notCurrentlyInShift: true }));
      return res.json({ success: true, data: anyToday, fallback: anyToday.length > 0 });
    }

    res.json({ success: true, data: onDuty });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const total    = await User.countDocuments();
    const approved = await User.countDocuments({ status:'approved' });
    const pending  = await User.countDocuments({ status:'pending' });
    const byRole   = await User.aggregate([
      { $group: { _id:'$role', count:{ $sum:1 } } },
      { $sort:  { count:-1 } },
    ]);
    res.json({ success:true, data:{ total, approved, pending, byRole } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};
