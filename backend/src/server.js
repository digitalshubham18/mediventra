require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const http      = require('http');
const { Server }= require('socket.io');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const app    = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods:['GET','POST'] }
});

// ── Middleware ────────────────────────────────────────────────────────
// Security headers. CSP is left off deliberately — this app talks to
// several third-party origins (Cloudinary, Razorpay, socket.io) and a
// hand-tuned CSP risks silently breaking one of them without being able
// to test live; the other headers (clickjacking, MIME-sniffing, etc.)
// are safe defaults with no such risk. crossOriginResourcePolicy is
// relaxed to 'cross-origin' because the frontend runs on a different
// origin/port and loads uploaded photos directly — helmet's stricter
// default would silently 403 every one of those images.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting — was installed as a dependency but never wired up,
// leaving /api/auth (login, register, OTP, password reset) open to
// unlimited brute-force attempts. A tighter limit on auth endpoints,
// a looser one on the rest of the API against general abuse.
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, error: 'Too many attempts from this device. Please wait a few minutes and try again.' },
}));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, error: 'Too many requests. Please slow down and try again shortly.' },
}));

// app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials:true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit:'50mb' }));
app.use(express.urlencoded({ extended:true, limit:'50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Database ──────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mediventra')
  .then(async () => {
    console.log('✅ MongoDB connected');
    // ── Self-heal: drop stale unique index on Payment.transactionId ──
    // Older schema versions had transactionId default:'' with a unique
    // index, which collides once 2+ pending payments exist. The current
    // schema uses sparse+undefined defaults, but Mongoose won't rewrite
    // an index that already exists in the database — so we drop it here
    // if found, and let Mongoose's syncIndexes recreate it correctly.
    try {
      const paymentsCollection = mongoose.connection.collection('payments');
      const indexes = await paymentsCollection.indexes();
      const staleIndex = indexes.find(i => i.key && i.key.transactionId === 1 && i.unique && !i.sparse);
      if (staleIndex) {
        await paymentsCollection.dropIndex(staleIndex.name);
        console.log(`🔧 Dropped stale non-sparse unique index "${staleIndex.name}" on payments.transactionId`);
      }
      const Payment = require('./models/Payment');
      await Payment.syncIndexes();
      console.log('✅ Payment indexes synced');
    } catch (idxErr) {
      console.warn('⚠️  Index repair skipped:', idxErr.message);
    }
  })
  .catch(err => console.error('❌ MongoDB error:', err));

// ── Make io accessible in controllers ────────────────────────────────
app.set('io', io);

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/records',    require('./routes/records'));
app.use('/api/facility',   require('./routes/facility'));
app.use('/api/leavetasks', require('./routes/leaveTasks'));
app.use('/api/salary',        require('./routes/salary'));
app.use('/api/appointments',  require('./routes/appointments'));
app.use('/api/medicines',     require('./routes/medicines'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/alerts',        require('./routes/alerts'));
app.use('/api/announcements', require('./routes/announcement'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/checklist',     require('./routes/checklist'));
app.use('/api/stafflogs',     require('./routes/staffLogs'));
app.use('/api/entry',         require('./routes/entry'));
app.use('/api/useractivity',  require('./routes/userActivity'));
app.use('/api/reviews',       require('./routes/reviews'));
app.use('/api/ambulance-trips', require('./routes/ambulanceTrips'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/refill-requests', require('./routes/refillRequests'));
app.use('/api/admissions', require('./routes/admissions'));
app.use('/api/nurse-calls', require('./routes/nurseCalls'));
app.use('/api/maintenance-requests', require('./routes/maintenanceRequests'));
app.use('/api/system', require('./routes/system'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/health-summary', require('./routes/healthSummary'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/doctor-cabins',   require('./routes/doctorCabins'));
app.use('/api/feedback',        require('./routes/feedback'));
app.use('/api/bugs',            require('./routes/bugReports'));
app.use('/api/audit-log',       require('./routes/auditLog'));
app.use('/api/family',          require('./routes/family'));
app.use('/api/discharge-plans', require('./routes/dischargePlans'));
app.use('/api/wearable',        require('./routes/wearable'));
app.use('/api/peer-consults',   require('./routes/peerConsults'));
app.use('/api/research-hub',    require('./routes/researchHub'));
app.use('/api/drug-check',      require('./routes/drugCheck'));
app.use('/api/staffing',        require('./routes/staffing'));
app.use('/api/assets',          require('./routes/assets'));
app.use('/api/sentiment',       require('./routes/sentiment'));
app.use('/api/fridge-logs',     require('./routes/fridge'));
app.use('/api/handovers',       require('./routes/handovers'));
app.use('/api/triage',          require('./routes/triage'));
app.use('/api/feedback-forms',  require('./routes/feedbackForms'));
app.use('/api/blood-bank',      require('./routes/bloodBank'));
app.use('/api/hospital-config', require('./routes/hospitalConfig'));
app.use('/api/surgeries',       require('./routes/surgeries'));
app.use('/api/attendance',      require('./routes/attendance'));
app.use('/api/invoices',        require('./routes/invoices'));
app.use('/api/inventory',       require('./routes/inventory'));
app.use('/api/tpa',             require('./routes/tpa'));
app.use('/api/visitors',        require('./routes/visitors'));
app.use('/api/public',          require('./routes/public'));
app.use('/api/radiology',       require('./routes/radiology'));
app.use('/api/dialysis',        require('./routes/dialysis'));
app.use('/api/nabh',            require('./routes/nabh'));

// Health check
app.get('/api/health', (req, res) => res.json({ status:'ok', time:new Date() }));

// ── Socket.io ─────────────────────────────────────────────────────────
// In-memory presence map: userId -> Set of active socket IDs. A user can
// have multiple simultaneous connections (different tabs/devices) — they
// only count as "offline" once every connection has dropped. This also
// means multiple people can be logged in (even with different roles)
// at the same time with no conflict; each gets their own JWT + socket.
const onlineUsers = new Map(); // userId -> { sockets: Set, name, role, lastSeen }

io.on('connection', socket => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Join personal notification room + mark this user online
  socket.on('join_user_room', (userId, userMeta = {}) => {
    socket.join(`user_${userId}`);
    socket.data.userId = userId;
    console.log(`👤 User ${userId} joined personal room`);

    const existing = onlineUsers.get(userId);
    if (existing) {
      existing.sockets.add(socket.id);
      existing.lastSeen = new Date();
    } else {
      onlineUsers.set(userId, {
        sockets: new Set([socket.id]),
        name: userMeta.name || '',
        role: userMeta.role || '',
        lastSeen: new Date(),
      });
      // Newly online — broadcast to admins
      io.emit('presence_update', { userId, online: true, name: userMeta.name, role: userMeta.role });
    }
  });

  // Join chat room
  socket.on('join_chat_room', room => {
    socket.join(room);
    console.log(`💬 Socket joined chat room: ${room}`);
  });

  socket.on('leave_chat_room', room => socket.leave(room));

  socket.on('typing', data => socket.to(data.room).emit('user_typing', data));

  // ── Video Consultation (WebRTC signaling relay) ──────────────────────
  // The server never touches the actual audio/video — it only relays the
  // handshake messages (who's joining, SDP offer/answer, ICE candidates)
  // between the two participants in an appointment's video room. The
  // actual media stream flows directly peer-to-peer once connected.
  socket.on('video_join', ({ roomId, name, role }) => {
    socket.join(`video_${roomId}`);
    socket.to(`video_${roomId}`).emit('video_peer_joined', { name, role });
  });
  socket.on('video_signal', ({ roomId, signal }) => {
    socket.to(`video_${roomId}`).emit('video_signal', { signal });
  });
  socket.on('video_leave', ({ roomId, name }) => {
    socket.to(`video_${roomId}`).emit('video_peer_left', { name });
    socket.leave(`video_${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);
    const userId = socket.data.userId;
    if (userId && onlineUsers.has(userId)) {
      const entry = onlineUsers.get(userId);
      entry.sockets.delete(socket.id);
      if (entry.sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit('presence_update', { userId, online: false });
      }
    }
  });
});

// Expose presence map to controllers via app locals
app.set('onlineUsers', onlineUsers);

// ── Global error handler (safety net for unhandled exceptions) ────────
// Catches any error passed via next(err) or thrown synchronously in routes
// that weren't caught by a local try/catch, so the client always gets
// clean JSON instead of a raw stack trace or a hung connection.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);

  // Multer/upload errors are almost always something the user can fix
  // (wrong file type, file too large, or — the common one — a malformed
  // multipart request because a client explicitly set the Content-Type
  // header instead of letting the browser add the boundary). These are
  // client-actionable, so surface the real reason even in production
  // instead of a generic "Something went wrong".
  if (err.name === 'MulterError' || /multipart|boundary/i.test(err.message || '')) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'That file is too large (max 50MB). Please choose a smaller photo.'
      : /multipart|boundary/i.test(err.message || '')
        ? 'Photo upload failed — the request was not formatted correctly. Please try again.'
        : (err.message || 'File upload failed. Please try again.');
    return res.status(400).json({ success: false, error: msg });
  }

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Additional routes (added)
// app.use('/api/appointments', require('./routes/appointments'));
// app.use('/api/payments',     require('./routes/payments'));
// app.use('/api/announcements',require('./routes/announcements'));
