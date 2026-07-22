// const nodemailer = require('nodemailer');

// function createTransporter() {
//   return nodemailer.createTransport({
//     host: process.env.EMAIL_HOST || 'smtp.gmail.com',
//     port: parseInt(process.env.EMAIL_PORT || '587'),
//     secure: process.env.EMAIL_SECURE === 'true',
//     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
//   });
// }

// exports.sendOtpEmail = async ({ to, name, otp, purpose }) => {
//   if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
//     console.log(`\n📧 [DEV OTP] To: ${to} | OTP: ${otp} | Purpose: ${purpose}\n`);
//     return { success: true, devMode: true };
//   }
//   const subject = purpose === 'register' ? '✅ Mediventra — Verify Your Email' : '🔐 Mediventra — Login OTP';
//   const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f1f5fb;padding:20px;border-radius:12px">
//     <div style="background:linear-gradient(135deg,#1648c9,#0891b2);padding:24px;border-radius:8px;text-align:center;margin-bottom:20px">
//       <h2 style="color:#fff;margin:0">🏥 Mediventra</h2>
//     </div>
//     <p style="color:#374151">Hello <strong>${name}</strong>,</p>
//     <p style="color:#374151">${purpose === 'register' ? 'Please verify your email to complete registration.' : 'Use this OTP to complete your login.'}</p>
//     <div style="background:#fff;border:2px dashed #c7d7fe;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
//       <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Your OTP</p>
//       <div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#1648c9;font-family:monospace">${otp}</div>
//       <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Valid for 10 minutes</p>
//     </div>
//     <p style="color:#94a3b8;font-size:12px">Do not share this OTP with anyone.</p>
//   </div>`;
//   const transporter = createTransporter();
//   await transporter.sendMail({ from: `"Mediventra" <${process.env.EMAIL_USER}>`, to, subject, html });
//   return { success: true };
// };

const nodemailer = require('nodemailer');
const HOSPITAL = 'Mediventra';
const PRIMARY  = '#2563eb';

const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

// ── Notification preference gate ────────────────────────────────────────
// Real wiring for the Settings toggles: emailNotifs is the master switch
// for non-essential email, and each category toggle (appointments,
// reminders, salary) further narrows it. Essential/security mail (OTPs,
// 2FA codes, password resets, payment-failure alerts) is never gated here
// — those always send regardless of preference.
exports.shouldEmail = (user, category) => {
  const prefs = user?.notificationPrefs;
  if (!prefs) return true; // no prefs set yet — default to sending
  if (prefs.emailNotifs === false) return false;
  if (category && prefs[category] === false) return false;
  return true;
};


const otpHTML = (name, otp, purpose, expiresIn) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#1e3a8a,${PRIMARY});padding:32px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">✚</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">${HOSPITAL}</h1>
  <p style="color:rgba(255,255,255,.7);font-size:13px;margin:4px 0 0">Hospital Management System</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 10px">Hi ${name} 👋</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 28px">
    You requested to <strong>${purpose}</strong>. Use the OTP below to proceed:
  </p>
  <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px dashed ${PRIMARY};border-radius:16px;padding:28px;text-align:center;margin:0 0 28px">
    <p style="color:#64748b;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">Your One-Time Password</p>
    <div style="font-size:52px;font-weight:900;letter-spacing:16px;color:#1e3a8a;font-family:'Courier New',monospace">${otp}</div>
    <p style="color:#ef4444;font-size:13px;font-weight:600;margin:16px 0 0">⏱ Expires in ${expiresIn}</p>
  </div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:24px">
    <p style="color:#dc2626;font-size:13px;margin:0">🔒 <strong>Never share this OTP</strong> with anyone — our staff will never ask for it.</p>
  </div>
  <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">If you did not request this, please ignore this email. Your account remains secure.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:20px 36px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">${HOSPITAL} · Secure Healthcare · 🔒 SSL Encrypted · HIPAA Aligned</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

const welcomeHTML = (name, role) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#059669,#34d399);padding:32px;text-align:center">
  <div style="font-size:52px;margin-bottom:8px">🎉</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Account Approved!</h1>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 14px">Welcome to ${HOSPITAL}, ${name}!</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px">
    Your <strong>${role}</strong> account has been <strong>approved by the administrator</strong>. You can now log in and access your dashboard.
  </p>
  <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 18px;margin-bottom:20px">
    <p style="color:#15803d;font-size:14px;font-weight:600;margin:0">✅ Your account is now active and fully ready to use.</p>
  </div>
  <p style="color:#94a3b8;font-size:13px;margin:0">Log in at your hospital portal to get started.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px 36px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">${HOSPITAL} · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

exports.sendOTP = async ({ to, name, otp, purpose, expiresIn = '10 minutes' }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  EMAIL_USER / EMAIL_PASS not set — skipping real email, OTP:', otp);
    return { success: false, reason: 'email_not_configured' };
  }
  try {
    const t = createTransporter();
    const info = await t.sendMail({
      from: `"${HOSPITAL}" <${process.env.EMAIL_USER}>`,
      to,
      subject: `${otp} is your ${HOSPITAL} verification code`,
      html: otpHTML(name, otp, purpose, expiresIn),
      text: `Your OTP for ${HOSPITAL}: ${otp}. Expires in ${expiresIn}.`,
    });
    console.log(`✅ OTP email → ${to} [${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed for ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

exports.sendWelcome = async ({ to, name, role }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return { success: false };
  try {
    const t = createTransporter();
    await t.sendMail({
      from: `"${HOSPITAL}" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Welcome to ${HOSPITAL} — Your Account Has Been Approved!`,
      html: welcomeHTML(name, role),
    });
    console.log(`✅ Welcome email → ${to}`);
    return { success: true };
  } catch (err) {
    console.error('Welcome email failed:', err.message);
    return { success: false };
  }
};

exports.sendGeneral = async ({ to, subject, html, text, attachments }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return { success: false };
  try {
    const t = createTransporter();
    await t.sendMail({ from:`"Mediventra" <${process.env.EMAIL_USER}>`, to, subject, html, text, attachments });
    return { success: true };
  } catch(err) { console.error('Email failed:', err.message); return { success: false }; }
};
