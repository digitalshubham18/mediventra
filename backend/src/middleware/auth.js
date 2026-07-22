// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// // Protect routes - verify JWT
// exports.protect = async (req, res, next) => {
//   let token;

//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     token = req.headers.authorization.split(' ')[1];
//   }

//   if (!token) {
//     return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.id);

//     if (!user) {
//       return res.status(401).json({ success: false, error: 'User no longer exists' });
//     }

//     if (user.status === 'suspended') {
//       return res.status(403).json({ success: false, error: 'Account suspended. Contact admin.' });
//     }

//     req.user = user;
//     next();
//   } catch (err) {
//     return res.status(401).json({ success: false, error: 'Invalid token' });
//   }
// };

// // Role-based authorization
// exports.authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         success: false,
//         error: `Role '${req.user.role}' is not authorized for this route`
//       });
//     }
//     next();
//   };
// };

// // Require admin approval
// exports.requireApproved = (req, res, next) => {
//   if (req.user.status !== 'approved') {
//     return res.status(403).json({
//       success: false,
//       error: 'Account pending admin approval'
//     });
//   }
//   next();
// };

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Routes that are polled frequently (presence, alerts, checklists, etc.) —
// logging every hit on these would flood the admin "what are they doing"
// feed with noise instead of useful signal, so they're skipped.
const ACTIVITY_SKIP_PATTERNS = [
  /^\/api\/users\/online/,
  /^\/api\/alerts/,
  /^\/api\/checklist/,
  /^\/api\/auth\/me/,
  /^\/api\/announcements/,
  /^\/api\/useractivity/,
];

// Human-readable label for a request, used in the admin activity feed.
function labelFor(method, path) {
  const seg = path.replace(/^\/api\//, '').split('/')[0];
  const NOUN = {
    appointments: 'Appointments', records: 'Health Records', medicines: 'Pharmacy',
    orders: 'Medicine Orders', salary: 'Salary', analytics: 'Analytics',
    facility: 'Facility/Schedules', leavetasks: 'Leave & Tasks', payments: 'Payments',
    stafflogs: 'Staff Logs', entry: 'Entry Verification', users: 'Users',
  };
  const noun = NOUN[seg] || seg || 'page';
  if (method === 'GET')    return `Viewed ${noun}`;
  if (method === 'POST')   return `Created entry in ${noun}`;
  if (method === 'PUT')    return `Updated entry in ${noun}`;
  if (method === 'DELETE') return `Deleted entry in ${noun}`;
  return `${method} ${noun}`;
}

function logActivity(req) {
  try {
    if (!req.user) return;
    if (ACTIVITY_SKIP_PATTERNS.some(rx => rx.test(req.originalUrl))) return;
    ActivityLog.create({
      user: req.user._id,
      role: req.user.role,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      label: labelFor(req.method, req.originalUrl),
    }).catch(() => {}); // fire-and-forget — never blocks or breaks the request
  } catch { /* never let activity logging break a request */ }
}

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, error: 'Not authenticated. Please login.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, error: 'User no longer exists.' });
    if (user.status === 'suspended') return res.status(403).json({ success: false, error: 'Account suspended.' });

    req.user = user;
    logActivity(req);
    next();
  } catch (e) {
    res.status(401).json({ success: false, error: 'Invalid or expired token. Please login again.' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: `Access denied. ${req.user.role} cannot perform this action.` });
  }
  next();
};
