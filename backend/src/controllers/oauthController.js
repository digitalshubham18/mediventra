const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const UserSession = require('../models/UserSession');

// A stray trailing space or \r character in .env (easy to introduce when
// editing on Windows, or pasting from some sources) silently corrupts an
// OAuth client_id/secret — the provider then rejects it with a generic
// "invalid client" error that looks like the visible value is wrong even
// when it isn't. Every credential read below goes through this.
const env = (name) => (process.env[name] || '').trim();

// Real OAuth2 login via Google and GitHub — both have genuine, free
// public OAuth APIs (unlike Apple Health, which has none at all). To
// activate either one, register a free OAuth app with the provider and
// set the client ID/secret/redirect URI in .env — without those, the
// button tells the user clearly what's missing rather than pretending
// to work.

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

function issueTokenAndRedirect(user, res) {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
  // Handed to the frontend via a one-time URL fragment (not a query
  // param, so it never gets logged by any server/proxy access log) —
  // the frontend's OAuth callback page picks it up and stores it.
  res.redirect(`${CLIENT_URL}/oauth-callback#token=${token}`);
}

async function trackSession(user, req) {
  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });
  UserSession.create({
    user: user._id, role: user.role,
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || '',
  }).catch(() => {});
}

// ── GOOGLE ────────────────────────────────────────────────────────────

// GET /api/auth/google — redirect to Google's consent screen
exports.googleLogin = (req, res) => {
  const GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID');
  const GOOGLE_REDIRECT_URI = env('GOOGLE_REDIRECT_URI');
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(400).json({
      success: false,
      error: 'Google sign-in isn\u2019t configured yet. Register a free OAuth app at https://console.cloud.google.com/apis/credentials and set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI in the backend .env.',
    });
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code', scope: 'openid email profile', prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

// GET /api/auth/google/callback
exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET');
    const GOOGLE_REDIRECT_URI = env('GOOGLE_REDIRECT_URI');
    if (!code) return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.email) return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);

    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: profile.email.toLowerCase() }] });
    if (!user) {
      // New patient signup via Google — auto-approved, same reasoning as
      // any self-registration path: they've just proven ownership of a
      // real email via Google's own login.
      user = await User.create({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        password: crypto.randomBytes(24).toString('hex'),
        role: 'patient', status: 'approved', emailVerified: true,
        avatar: profile.picture || '', googleId: profile.id,
      });
    } else if (!user.googleId) {
      user.googleId = profile.id;
      await user.save({ validateBeforeSave: false });
    }

    if (user.status !== 'approved') return res.redirect(`${CLIENT_URL}/login?error=account_pending_approval`);

    await trackSession(user, req);
    issueTokenAndRedirect(user, res);
  } catch (e) {
    console.error('Google OAuth error:', e.message);
    res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
  }
};

// ── GITHUB ────────────────────────────────────────────────────────────

// GET /api/auth/github — redirect to GitHub's consent screen
exports.githubLogin = (req, res) => {
  const GITHUB_CLIENT_ID = env('GITHUB_CLIENT_ID');
  const GITHUB_REDIRECT_URI = env('GITHUB_REDIRECT_URI');
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return res.status(400).json({
      success: false,
      error: 'GitHub sign-in isn\u2019t configured yet. Register a free OAuth app at https://github.com/settings/developers and set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI in the backend .env.',
    });
  }
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID, redirect_uri: GITHUB_REDIRECT_URI, scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

// GET /api/auth/github/callback
exports.githubCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const GITHUB_CLIENT_ID = env('GITHUB_CLIENT_ID');
    const GITHUB_CLIENT_SECRET = env('GITHUB_CLIENT_SECRET');
    if (!code) return res.redirect(`${CLIENT_URL}/login?error=github_auth_failed`);

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(`${CLIENT_URL}/login?error=github_auth_failed`);

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Mediventra-HMS' },
    });
    const profile = await profileRes.json();

    // GitHub only returns email in /user if it's public; fetch /user/emails as a fallback.
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Mediventra-HMS' },
      });
      const emails = await emailsRes.json();
      email = Array.isArray(emails) ? (emails.find(e => e.primary)?.email || emails[0]?.email) : null;
    }
    if (!email) return res.redirect(`${CLIENT_URL}/login?error=github_no_email`);

    let user = await User.findOne({ $or: [{ githubId: String(profile.id) }, { email: email.toLowerCase() }] });
    if (!user) {
      user = await User.create({
        name: profile.name || profile.login || email.split('@')[0],
        email: email.toLowerCase(),
        password: crypto.randomBytes(24).toString('hex'),
        role: 'patient', status: 'approved', emailVerified: true,
        avatar: profile.avatar_url || '', githubId: String(profile.id),
      });
    } else if (!user.githubId) {
      user.githubId = String(profile.id);
      await user.save({ validateBeforeSave: false });
    }

    if (user.status !== 'approved') return res.redirect(`${CLIENT_URL}/login?error=account_pending_approval`);

    await trackSession(user, req);
    issueTokenAndRedirect(user, res);
  } catch (e) {
    console.error('GitHub OAuth error:', e.message);
    res.redirect(`${CLIENT_URL}/login?error=github_auth_failed`);
  }
};
