
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { buildFileUrl } = require('../middleware/upload');
const { logAction } = require('../utils/auditLog');
const { locateIp } = require('../utils/geoLocate');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');
const PhoneChangeRequest = require('../models/PhoneChangeRequest');
const { notify } = require('../utils/notify');

// ── In-memory OTP store (use Redis in production) ──────────────────────
const otpStore = new Map();

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// Shared minimum-strength check used everywhere a password is set
// (register goes through express-validator instead, but change-password
// and reset-password call this directly since they don't run through
// that validation chain).
function passwordStrengthError(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(pw))    return 'Password must contain at least one number';
  return null;
}
function hashOTP(otp) { return crypto.createHash('sha256').update(otp).digest('hex'); }

function storeOTP(email, otp, purpose, ttlMs = 10 * 60 * 1000) {
  otpStore.set(`${purpose}:${email.toLowerCase()}`, { hash: hashOTP(otp), expires: Date.now() + ttlMs });
}

function verifyOTP(email, otp, purpose) {
  const key = `${purpose}:${email.toLowerCase()}`;
  const entry = otpStore.get(key);
  if (!entry) return { valid: false, reason: 'OTP not found. Please request a new one.' };
  if (Date.now() > entry.expires) { otpStore.delete(key); return { valid: false, reason: 'OTP has expired. Please request a new one.' }; }
  if (entry.hash !== hashOTP(otp)) return { valid: false, reason: 'Incorrect OTP. Please try again.' };
  otpStore.delete(key);
  return { valid: true };
}

const sendToken = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
  user.password = undefined;
  res.status(statusCode).json({ success: true, token, data: user });
};

// ── POST /api/auth/send-register-otp ─────────────────────────────────────
exports.sendRegisterOTP = async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, error: 'Name and email are required' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, error: 'An account with this email already exists. Please login instead.' });

    const otp = generateOTP();
    storeOTP(email, otp, 'register');

    // Verification is email-only — no SMS/text-message OTP is sent for
    // registration. `phone` is still accepted and stored on the account,
    // it's just not used for verification purposes.
    const emailResult = await emailService.sendOTP({
      to: email, name,
      otp,
      purpose: 'verify your email for Mediventra registration',
      expiresIn: '10 minutes',
    });

    res.json({
      success: true,
      message: emailResult.success
        ? `Verification OTP sent to ${email}. Please check your inbox (and spam folder).`
        : `OTP generated (email service not configured). Check server console for OTP.`,
      emailSent: emailResult.success,
      // Show OTP in dev mode only
      ...(process.env.NODE_ENV !== 'production' ? { _dev_otp: otp } : {}),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── POST /api/auth/register ───────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });

    const { name, email, password, role, otp, phone, department, bloodGroup, licenseNumber, specialization, gender, age, weight, height } = req.body;

    // Verify OTP
    if (!otp) return res.status(400).json({ success: false, error: 'OTP is required to complete registration' });
    const otpCheck = verifyOTP(email, otp, 'register');
    if (!otpCheck.valid) return res.status(400).json({ success: false, error: otpCheck.reason });

    // Duplicate check
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });

    const autoApprove = role === 'patient';

    const user = await User.create({
      name, email: email.toLowerCase(), password,
      role: role || 'patient',
      phone, department, bloodGroup, licenseNumber, specialization,
      gender, age,
      weight: weight === '' || weight == null ? undefined : Number(weight),
      height: height === '' || height == null ? undefined : Number(height),
      status: autoApprove ? 'approved' : 'pending',
      emailVerified: true,
      joiningDate: new Date(),
    });

    res.status(201).json({
      success: true,
      message: autoApprove
        ? 'Registration complete! You can now login.'
        : 'Registration complete! Your account is pending admin approval. You will be notified via email once approved.',
      data: { id: user._id, name: user.name, role: user.role, status: user.status },
    });

    // Confirmation email — sent regardless of role; wording differs based
    // on whether the account is immediately usable (patients) or awaiting
    // admin approval (staff roles).
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#1648c9,#0ea5e9);padding:32px;text-align:center">
  <div style="font-size:46px;margin-bottom:8px">📝</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Registration Received!</h1>
  <p style="color:rgba(255,255,255,.85);font-size:14px;margin:8px 0 0">Mediventra Hospital Management System</p>
</td></tr>
<tr><td style="padding:34px">
  <h2 style="color:#0f172a;font-size:19px;font-weight:700;margin:0 0 14px">Hi ${user.name}, welcome aboard! 👋</h2>
  ${autoApprove ? `
  <p style="color:#64748b;font-size:14.5px;line-height:1.7;margin:0 0 20px">Your patient account has been created successfully. You can now log in and start booking appointments, accessing your health records, and more.</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:linear-gradient(135deg,#1648c9,#0c2c7a);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px">Log In Now →</a>
  </td></tr></table>` : `
  <p style="color:#64748b;font-size:14.5px;line-height:1.7;margin:0 0 16px">We've received your registration as a <strong>${user.role}</strong>. Your account is now <strong>pending admin approval</strong> — you'll receive another email the moment it's approved and ready to use.</p>
  <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px 18px">
    <p style="margin:0;color:#92400e;font-size:13px;font-weight:600">⏳ This usually takes 1-2 business days. No action is needed from you right now.</p>
  </div>`}
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;
    emailService.sendGeneral({
      to: user.email,
      subject: autoApprove ? '✅ Registration Successful — Mediventra' : '📝 Registration Received — Pending Approval | Mediventra',
      html,
    }).catch(console.error);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, error: 'Email already registered' });
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────
// Shared by the non-2FA and post-2FA-verification paths — marks the user
// online, opens a session record, and issues the real JWT.
const completeLogin = async (user, req, res) => {
  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });

  const now = new Date();
  const stale = await UserSession.find({ user: user._id, active: true });
  for (const s of stale) {
    s.active = false;
    s.logoutAt = now;
    s.durationSeconds = Math.max(0, Math.round((now - s.loginAt) / 1000));
    await s.save().catch(() => {});
  }

  UserSession.create({
    user: user._id, role: user.role,
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    location: locateIp(req.ip || req.headers['x-forwarded-for']),
    userAgent: req.headers['user-agent'] || '',
  }).catch(e => console.warn('Session log failed:', e.message));

  sendToken(user, 200, res);
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ success: false, error: 'Your account is awaiting admin approval. You will receive an email once approved.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your account has been suspended. Please contact the administrator.' });
    }

    // ── Real Two-Factor Authentication ──────────────────────────────────
    // When the user has 2FA switched on in Settings, password verification
    // alone is not enough — a fresh OTP is emailed and must be verified
    // before a session/token is ever issued. No token, no online-status
    // flip, no session log until this second step succeeds.
    if (user.notificationPrefs?.twoFA) {
      const otp = generateOTP();
      storeOTP(email, otp, 'login_2fa', 10 * 60 * 1000);
      // 2FA verification is email-only — no SMS/text-message OTP is sent.
      emailService.sendOTP({ to: user.email, name: user.name, otp, purpose: 'login verification' }).catch(console.error);
      return res.json({
        success: true, requiresTwoFactor: true, email: user.email,
        message: 'A verification code has been sent to your email.',
      });
    }

    await completeLogin(user, req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── POST /api/auth/verify-login-otp — second step of 2FA login ───────────
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP are required' });

    const check = verifyOTP(email, otp, 'login_2fa');
    if (!check.valid) return res.status(400).json({ success: false, error: check.reason });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.status === 'suspended') return res.status(403).json({ success: false, error: 'Your account has been suspended.' });

    await completeLogin(user, req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── PUT /api/auth/profile ─────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    // NOTE: 'phone' is deliberately NOT in this list — changing the phone
    // number on file requires OTP verification (see requestPhoneChangeOTP /
    // confirmPhoneChange below), the same way email changes do.
    const allowed = ['name','department','bloodGroup','address','specialization','gender','age','bankAccount','notificationPrefs','bankDetails','emergencyContact','govtId','profilePhoto','weight','height','bio','degrees','experiences','experienceYears','preferredLanguage'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Auto-calculate documentation status — only relevant for salaried
    // staff (bank details exist to receive a salary; patients don't get one)
    const existing = await User.findById(req.user.id);
    if (existing.role !== 'patient') {
      const merged = { ...existing.toObject(), ...updates };
      const bd = merged.bankDetails || {};
      const ec = merged.emergencyContact || {};
      const gi = merged.govtId || {};
      const isComplete = !!(bd.accountNumber && bd.ifsc && ec.name && ec.phone && merged.address && gi.number);
      updates.documentationStatus = isComplete ? 'complete' : 'incomplete';
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── Phone number changes now go through admin approval instead of a ────────
// self-serve OTP flow. A user can no longer verify a new phone number
// themselves — they submit a request, and an admin reviews and approves
// (or rejects) it before the number on file actually changes.

// POST /api/auth/phone/request-change — user submits a request
exports.requestPhoneChange = async (req, res) => {
  try {
    const newPhone = (req.body.newPhone || '').trim();
    const reason = (req.body.reason || '').trim();
    if (!newPhone || newPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Enter a valid phone number' });
    }
    if (req.user.phone && newPhone === req.user.phone) {
      return res.status(400).json({ success: false, error: 'That\u2019s already your current phone number' });
    }
    const existingOnUser = await User.findOne({ phone: newPhone });
    if (existingOnUser) return res.status(400).json({ success: false, error: 'That phone number is already in use by another account' });

    const alreadyPending = await PhoneChangeRequest.findOne({ user: req.user.id, status: 'pending' });
    if (alreadyPending) return res.status(400).json({ success: false, error: 'You already have a phone number change request awaiting admin review.' });

    const request = await PhoneChangeRequest.create({
      user: req.user.id,
      currentPhone: req.user.phone || '',
      requestedPhone: newPhone,
      reason,
      status: 'pending',
    });

    const io = req.app.get('io');
    if (io) io.emit('phone_change_requested', { requestId: request._id, userId: req.user.id, name: req.user.name, requestedPhone: newPhone });

    logAction({
      actor: req.user, action: 'phone_change_requested',
      description: `${req.user.name} requested to change phone number to ${newPhone}`,
      targetType: 'User', targetId: req.user.id,
    });

    res.status(201).json({ success: true, data: request, message: 'Your request has been sent to the admin for approval. You\u2019ll be notified once it\u2019s reviewed.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/auth/phone/my-requests — user checks status of their own requests
exports.getMyPhoneChangeRequests = async (req, res) => {
  try {
    const requests = await PhoneChangeRequest.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/auth/phone/requests — admin: list all requests (default: pending first)
exports.getPhoneChangeRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const requests = await PhoneChangeRequest.find(filter)
      .populate('user', 'name email phone role avatar')
      .populate('reviewedBy', 'name')
      .sort({ status: 1, createdAt: -1 });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/auth/phone/requests/:id/approve — admin approves, phone is updated
exports.approvePhoneChangeRequest = async (req, res) => {
  try {
    const request = await PhoneChangeRequest.findById(req.params.id).populate('user', 'name email phone');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'This request has already been reviewed' });

    const existingOnUser = await User.findOne({ phone: request.requestedPhone });
    if (existingOnUser && String(existingOnUser._id) !== String(request.user._id)) {
      return res.status(400).json({ success: false, error: 'That phone number is now in use by another account' });
    }

    const oldPhone = request.user.phone || '(none on file)';
    const user = await User.findByIdAndUpdate(request.user._id, { phone: request.requestedPhone }, { new: true });

    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.adminNote = (req.body.adminNote || '').trim();
    await request.save();

    if (user.email) {
      emailService.sendGeneral({
        to: user.email,
        subject: '✅ Phone number change approved — Mediventra',
        html: `<p style="font-family:sans-serif;font-size:14px;color:#374151">Hi ${user.name}, your request to change your account's phone number from <strong>${oldPhone}</strong> to <strong>${request.requestedPhone}</strong> has been approved by the admin. Your phone number is now updated.</p>`,
      }).catch(() => {});
    }

    logAction({
      actor: req.user, action: 'phone_change_approved',
      description: `Approved phone number change for ${user.name} — ${oldPhone} → ${request.requestedPhone}`,
      targetType: 'User', targetId: user._id,
    });

    const io = req.app.get('io');
    if (io) io.to(`user_${user._id}`).emit('phone_change_reviewed', { status: 'approved', phone: user.phone });
    await notify(req, user._id, { type:'phone_change_reviewed', title:'✅ Phone number updated', message:`Your phone number was changed to ${user.phone}`, link:'/settings', icon:'✅' });

    res.json({ success: true, data: { request, user }, message: 'Phone number change approved and updated.' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, error: 'That phone number is already in use' });
    res.status(500).json({ success: false, error: e.message });
  }
};

// PUT /api/auth/phone/requests/:id/reject — admin rejects with an optional note
exports.rejectPhoneChangeRequest = async (req, res) => {
  try {
    const request = await PhoneChangeRequest.findById(req.params.id).populate('user', 'name email');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'This request has already been reviewed' });

    request.status = 'rejected';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.adminNote = (req.body.adminNote || '').trim();
    await request.save();

    if (request.user?.email) {
      emailService.sendGeneral({
        to: request.user.email,
        subject: '❌ Phone number change request declined — Mediventra',
        html: `<p style="font-family:sans-serif;font-size:14px;color:#374151">Hi ${request.user.name}, your request to change your phone number to <strong>${request.requestedPhone}</strong> was declined by the admin.${request.adminNote ? ` Note: ${request.adminNote}` : ''} Please contact the hospital admin for more details.</p>`,
      }).catch(() => {});
    }

    logAction({
      actor: req.user, action: 'phone_change_rejected',
      description: `Rejected phone number change request for ${request.user?.name} (wanted ${request.requestedPhone})`,
      targetType: 'User', targetId: request.user?._id,
    });

    const io = req.app.get('io');
    if (io && request.user?._id) io.to(`user_${request.user._id}`).emit('phone_change_reviewed', { status: 'rejected', note: request.adminNote });
    if (request.user?._id) await notify(req, request.user._id, { type:'phone_change_reviewed', title:'❌ Phone number change declined', message: request.adminNote || 'Your phone number change request was declined', link:'/settings', icon:'❌' });

    res.json({ success: true, data: request, message: 'Request rejected.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
// Step 1 of changing your email: send a 6-digit code to the NEW address.
// Requiring the code to land in the new inbox (not the old one) proves
// the person actually owns/controls that address before we switch to it.
exports.requestEmailChangeOTP = async (req, res) => {
  try {
    const newEmail = (req.body.newEmail || '').trim().toLowerCase();
    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
      return res.status(400).json({ success: false, error: 'Enter a valid new email address' });
    }
    if (newEmail === req.user.email) {
      return res.status(400).json({ success: false, error: 'That\u2019s already your current email' });
    }
    const existing = await User.findOne({ email: newEmail });
    if (existing) return res.status(400).json({ success: false, error: 'That email is already in use by another account' });

    const otp = generateOTP();
    // Keyed by the requesting user's id + new email, so this can't be
    // confused with the register/login-2FA OTP flows even if the same
    // address happens to be involved in more than one at once.
    storeOTP(`${req.user.id}:${newEmail}`, otp, 'email_change');

    const emailResult = await emailService.sendOTP({
      to: newEmail, name: req.user.name, otp,
      purpose: 'confirm your new email address for Mediventra',
      expiresIn: '10 minutes',
    });
    // The OTP itself must be proven via the NEW email inbox (that's the
    // whole point of this flow), but we also text the code — and a heads
    // up — to the phone already on file, both as a convenient second copy
    // and as a security notice in case this wasn't the account holder.
    let smsResult = { success: false };
    if (req.user.phone) {
      smsResult = await smsService.sendSMS({
        to: req.user.phone,
        body: `Mediventra: A request to change your account email to ${newEmail} was made. Verification code: ${otp} (valid 10 minutes). If this wasn't you, please contact the hospital immediately.`,
      });
    }

    res.json({
      success: true,
      message: emailResult.success
        ? `Verification code sent to ${newEmail}${smsResult.success ? ' and your registered phone' : ''}. Please check your inbox (and spam folder).`
        : 'OTP generated (email service not configured). Check server console for OTP.',
      emailSent: emailResult.success,
      smsSent: smsResult.success,
      ...(process.env.NODE_ENV !== 'production' ? { _dev_otp: otp, ...(req.user.phone && !smsResult.success ? { _dev_sms_reason: smsResult.reason } : {}) } : {}),
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/auth/email/confirm ──────────────────────────────────────────
// Step 2: verify the code and actually switch the account over to the
// new email.
exports.confirmEmailChange = async (req, res) => {
  try {
    const newEmail = (req.body.newEmail || '').trim().toLowerCase();
    const { otp } = req.body;
    if (!newEmail || !otp) return res.status(400).json({ success: false, error: 'New email and OTP are required' });

    const check = verifyOTP(`${req.user.id}:${newEmail}`, otp, 'email_change');
    if (!check.valid) return res.status(400).json({ success: false, error: check.reason });

    const existing = await User.findOne({ email: newEmail });
    if (existing) return res.status(400).json({ success: false, error: 'That email is already in use by another account' });

    const oldEmail = req.user.email;
    const user = await User.findByIdAndUpdate(req.user.id, { email: newEmail, emailVerified: true }, { new: true });

    emailService.sendGeneral({
      to: oldEmail,
      subject: '🔐 Your Mediventra email was changed',
      html: `<p style="font-family:sans-serif;font-size:14px;color:#374151">Hi ${user.name}, your account's login email was just changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>. If you didn't make this change, please contact support immediately.</p>`,
    }).catch(() => {});

    logAction({
      actor: req.user, action: 'email_changed',
      description: `${user.name} changed their login email from ${oldEmail} to ${newEmail}`,
      targetType: 'User', targetId: user._id,
    });

    res.json({ success: true, data: user, message: 'Email updated successfully!' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, error: 'That email is already in use' });
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── POST /api/auth/avatar — upload/replace your profile photo ────────────
// Shown at the top of every dashboard once set, for every role.
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No photo uploaded' });
    const url = buildFileUrl(req.file, 'avatars');
    const user = await User.findByIdAndUpdate(req.user.id, { avatar: url }, { new: true });
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false, lastSeen: new Date() }, { validateBeforeSave: false });

    // Close the most recent open session and record how long they were on
    // the site — this is what powers "time spent on website" for admins.
    const session = await UserSession.findOne({ user: req.user.id, active: true }).sort({ loginAt: -1 });
    if (session) {
      const now = new Date();
      session.logoutAt = now;
      session.active = false;
      session.durationSeconds = Math.max(0, Math.round((now - session.loginAt) / 1000));
      await session.save();
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── PUT /api/auth/change-password ────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Both passwords required' });
    const pwErr = passwordStrengthError(newPassword);
    if (pwErr) return res.status(400).json({ success: false, error: pwErr });

    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, error: 'No account found with this email address' });

    const otp = generateOTP();
    storeOTP(email, otp, 'reset');

    // Password reset verification is email-only — no SMS/text-message OTP.
    const emailResult = await emailService.sendOTP({
      to: email, name: user.name,
      otp,
      purpose: 'reset your Mediventra password',
      expiresIn: '10 minutes',
    });

    res.json({
      success: true,
      message: emailResult.success
        ? `Password reset OTP sent to ${email}`
        : `OTP generated (check server console)`,
      emailSent: emailResult.success,
      ...(process.env.NODE_ENV !== 'production' ? { _dev_otp: otp } : {}),
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/auth/reset-password ────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP and new password are all required' });
    }
    const pwErr = passwordStrengthError(newPassword);
    if (pwErr) return res.status(400).json({ success: false, error: pwErr });

    const otpCheck = verifyOTP(email, otp, 'reset');
    if (!otpCheck.valid) return res.status(400).json({ success: false, error: otpCheck.reason });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully! You can now login with your new password.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
