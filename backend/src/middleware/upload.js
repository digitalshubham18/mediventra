const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Persistent storage (Cloudinary) vs local disk ───────────────────────
// Uploaded files (lab report photos, avatars, prescriptions) written to
// local disk only survive as long as the server process/container does.
// Most hosting platforms (Render, Railway, Heroku, etc.) wipe local disk
// on every restart, redeploy, or when scaling to a new instance — so a
// photo that worked yesterday 404s today with no code ever touching it.
// When Cloudinary credentials are present in the environment, files are
// uploaded there instead — a real persistent store, unaffected by
// server restarts, on any hosting platform. Without those credentials
// (e.g. local development), it transparently falls back to local disk
// exactly as before.
const cloudinaryEnabled = !!(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

let storage;

if (cloudinaryEnabled) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
      folder: `mediventra/${req.uploadFolder || 'records'}`,
      public_id: uuidv4(),
      // Let Cloudinary infer resource_type so PDFs/docs upload as 'raw'
      // and images upload as 'image' automatically.
      resource_type: 'auto',
    }),
  });

  console.log('📦 File uploads: using Cloudinary (persistent across restarts)');
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.uploadFolder || 'records';
      const dir = path.join(__dirname, `../../uploads/${folder}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  });

  console.log('⚠️  File uploads: using local disk — files will NOT survive a server restart/redeploy on most hosting platforms. Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET in .env for persistent storage.');
}

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/png','image/jpg','image/webp','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
};

// Support both single 'file' and multiple 'labPhotos' fields
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

// ── buildFileUrl ─────────────────────────────────────────────────────────
// Controllers need one consistent way to turn an uploaded `file` object
// into a URL the frontend can load, regardless of which storage backend
// is active. Cloudinary's multer adapter puts the final absolute HTTPS
// URL in `file.path`; local disk storage only gives a filesystem path, so
// a relative `/uploads/...` URL is built instead (served by
// express.static — see server.js).
function buildFileUrl(file, folder = 'records') {
  if (cloudinaryEnabled) return file.path; // already an absolute https:// URL
  return `/uploads/${folder}/${file.filename}`;
}

// ── toAbsoluteUrl ─────────────────────────────────────────────────────────
// Local-disk URLs (e.g. '/uploads/bug-reports/xyz.png') work fine in the
// app itself — the frontend's getFileUrl() helper prefixes them with the
// API origin before rendering an <img>. But an EMAIL has no origin to
// resolve a relative path against; a bare '/uploads/...' src simply never
// loads in any mail client. This turns any file URL into a fully
// qualified one right before it gets embedded in outgoing email HTML.
// Already-absolute URLs (Cloudinary) pass through unchanged.
function toAbsoluteUrl(url, req) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url; // already absolute (Cloudinary)
  const base = process.env.SERVER_URL || (req ? `${req.protocol}://${req.get('host')}` : '');
  return `${base}${url}`;
}

module.exports = upload;
module.exports.buildFileUrl = buildFileUrl;
module.exports.toAbsoluteUrl = toAbsoluteUrl;
module.exports.cloudinaryEnabled = cloudinaryEnabled;
