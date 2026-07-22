// Lightweight SMS sender. Tries MSG91 first (if MSG91_AUTH_KEY is set —
// a simple REST call, no extra npm package, and the most commonly used
// gateway for Indian numbers), then Twilio (if TWILIO_* vars are set),
// then falls back to a console log (same dev-mode pattern already used
// by emailService.js) so the app never crashes without a provider set up.
let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch {
    return null; // twilio package not installed — degrade gracefully
  }
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.trim().replace(/[\s-()]/g, '');
  if (p.startsWith('+')) return p;
  p = p.replace(/^0+/, ''); // strip a leading 0 (common local-dialing format, e.g. "09876543210")
  if (p.length === 10) return `+91${p}`;       // plain 10-digit Indian mobile number
  if (/^91\d{10}$/.test(p)) return `+${p}`;    // already has the 91 country code, just missing "+"
  return `+${p}`;
}

async function sendViaMsg91(phone, body) {
  // MSG91's plain-text send endpoint — simplest possible integration,
  // just an auth key. Number sent WITHOUT the "+" (MSG91's API expects
  // country code + number with no punctuation).
  const digits = phone.replace('+', '');
  const res = await fetch('https://api.msg91.com/api/v2/sendsms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: process.env.MSG91_AUTH_KEY },
    body: JSON.stringify({
      sender: process.env.MSG91_SENDER_ID || 'MEDHMS',
      route: '4',
      country: '91',
      sms: [{ message: body, to: [digits] }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.type === 'error') throw new Error(data.message || `MSG91 request failed (${res.status})`);
  return data;
}

// exports.sendSMS — generic text message
exports.sendSMS = async ({ to, body }) => {
  const phone = normalizePhone(to);
  if (!phone) return { success: false, reason: 'no_phone' };

  // 1. MSG91, if configured
  if (process.env.MSG91_AUTH_KEY) {
    try {
      await sendViaMsg91(phone, body);
      console.log(`📱 SMS sent via MSG91 → ${phone}`);
      return { success: true };
    } catch (err) {
      console.error('MSG91 send failed, trying Twilio if configured:', err.message);
      // fall through to Twilio rather than give up immediately
    }
  }

  // 2. Twilio, if configured
  const client = getTwilioClient();
  if (client) {
    try {
      await client.messages.create({ body, from: process.env.TWILIO_FROM_NUMBER, to: phone });
      console.log(`📱 SMS sent via Twilio → ${phone}`);
      return { success: true };
    } catch (err) {
      console.error('Twilio send failed:', err.message);
      return { success: false, reason: err.message };
    }
  }

  // 3. Nothing configured — degrade gracefully instead of crashing
  console.warn(`⚠️  No SMS provider configured (MSG91_AUTH_KEY / TWILIO_SID) — would have sent to ${phone}: "${body}"`);
  return { success: false, reason: 'sms_not_configured', devBody: body };
};

// exports.sendOtpSMS — OTP-specific helper, mirrors emailService.sendOTP
exports.sendOtpSMS = async ({ to, otp, purpose = 'verification', expiresIn = '10 minutes' }) => {
  const body = `Mediventra: Your ${purpose} code is ${otp}. Valid for ${expiresIn}. Do not share this code with anyone.`;
  return exports.sendSMS({ to, body });
};
