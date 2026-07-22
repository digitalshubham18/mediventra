import axios from 'axios';

// ── File URL helper ─────────────────────────────────────────────────────
// Every uploaded file (lab report photos, avatars, prescriptions) is
// stored on the backend and referenced by a relative path like
// '/uploads/records/xyz.jpg'. That path is meaningless on its own — the
// browser resolves it against the FRONTEND's own origin, not the API's,
// so images silently 404 unless it's turned into an absolute URL.
// This was inconsistent across the app: some pages remembered to prefix
// with REACT_APP_SOCKET_URL, others (e.g. the Lab Dashboard's own report
// photo history) used the raw relative path directly and were broken for
// every single viewer, regardless of role.
//
// SOCKET_URL falls back to API_URL (minus the trailing /api) so a photo
// isn't completely broken just because only one of the two env vars was
// configured for a deployment.
const API_URL    = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

export const getFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${SOCKET_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token — sessionStorage keeps each browser tab's login
// independent (see AuthContext.js for why: shared front-desk computers
// with multiple staff logged in on different tabs).
api.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('mediventra_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  // For file uploads (FormData), the browser MUST generate the
  // Content-Type header itself so it can append the multipart boundary.
  // The axios instance above sets a default 'application/json' header,
  // and that default can still leak through for FormData requests in
  // some axios/browser combos — explicitly clearing it here guarantees
  // every upload (avatar, lab report photos, prescriptions) gets parsed
  // correctly on the server instead of arriving with no file attached.
  if (cfg.data instanceof FormData) {
    delete cfg.headers['Content-Type'];
    delete cfg.headers['content-type'];
  }
  return cfg;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('mediventra_token');
      sessionStorage.removeItem('mediventra_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── AUTH ─────────────────────────────────────────────────────────────
export const authAPI = {
  sendRegisterOTP: (email, name, phone) => api.post('/auth/send-register-otp', { email, name, phone }),
  register:        (data)        => api.post('/auth/register', data),
  login:           (data)        => api.post('/auth/login', data),
  verifyLoginOtp:  (data)        => api.post('/auth/verify-login-otp', data),
  uploadAvatar:    (file)        => { const fd = new FormData(); fd.append('avatar', file); return api.post('/auth/avatar', fd); },
  getMe:           ()            => api.get('/auth/me'),
  updateProfile:   (data)        => api.put('/auth/profile', data),
  logout:          ()            => api.post('/auth/logout'),
  changePassword:  (data)        => api.put('/auth/change-password', data),
  requestEmailOTP: (newEmail)    => api.post('/auth/email/request-otp', { newEmail }),
  confirmEmailChange: (newEmail, otp) => api.post('/auth/email/confirm', { newEmail, otp }),
  // Phone number changes go through admin approval instead of a self-serve OTP
  requestPhoneChange:      (newPhone, reason) => api.post('/auth/phone/request-change', { newPhone, reason }),
  getMyPhoneChangeRequests: ()   => api.get('/auth/phone/my-requests'),
  getPhoneChangeRequests:  (params) => api.get('/auth/phone/requests', { params }),
  approvePhoneChangeRequest: (id, adminNote) => api.put(`/auth/phone/requests/${id}/approve`, { adminNote }),
  rejectPhoneChangeRequest:  (id, adminNote) => api.put(`/auth/phone/requests/${id}/reject`, { adminNote }),
  forgotPassword:  (email)       => api.post('/auth/forgot-password', { email }),
  resetPassword:   (data)        => api.post('/auth/reset-password', data),
};

// ── USERS ─────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll:   (params) => api.get('/users', { params }),
  getOne:   (id)     => api.get(`/users/${id}`),
  update:   (id,d)   => api.put(`/users/${id}`, d),
  approve:  (id)     => api.put(`/users/${id}/approve`),
  delete:   (id)     => api.delete(`/users/${id}`),
  getStats: ()       => api.get('/users/stats'),
  getOnline:()       => api.get('/users/online'),
  // Doctor/nurse/admin adding a patient directly — no OTP round-trip,
  // since staff is already authenticated and the patient is right there.
  createPatient: (data) => api.post('/users/patients', data),
  updateVitals: (id, data) => api.put(`/users/${id}/vitals`, data),
  getOnDuty: (role) => api.get('/users/on-duty', { params: { role } }),
};

// ── RECORDS ───────────────────────────────────────────────────────────
export const recordsAPI = {
  getAll:   (params) => api.get('/records', { params }),
  getOne:   (id)     => api.get(`/records/${id}`),
  // NOTE: never set `Content-Type: multipart/form-data` manually here —
  // the browser needs to generate that header itself so it can append
  // the `boundary=...` parameter. Setting it explicitly (as this used to
  // do) sends a boundary-less header, which the backend's multer parser
  // can't parse — every photo upload failed with a 500 "Something went
  // wrong" as a result. Axios detects FormData automatically and sets
  // the correct header + boundary on its own.
  create:   (fd)     => api.post('/records', fd),
  update:   (id, data) => {
    // Always send as multipart so the server receives req.files when a
    // photo is attached. If data is already a FormData object, use it
    // directly; otherwise convert it so text-only updates still work.
    if (data instanceof FormData) {
      return api.put(`/records/${id}`, data);
    }
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, typeof v === 'object' && !(v instanceof File) ? JSON.stringify(v) : v);
    });
    return api.put(`/records/${id}`, fd);
  },
  delete:   (id)     => api.delete(`/records/${id}`),
};

// ── HEALTH SUMMARY ──────────────────────────────────────────────────────
export const healthSummaryAPI = {
  // patientId omitted = "my own" (patient self-download)
  downloadBlob: (patientId) => api.get(`/health-summary${patientId ? '/' + patientId : ''}`, { responseType: 'blob' }),
};

// ── FACILITY ──────────────────────────────────────────────────────────
export const facilityAPI = {
  // Rooms
  getRooms:        (params) => api.get('/facility/rooms', { params }),
  createRoom:      (d)      => api.post('/facility/rooms', d),
  updateRoom:      (id,d)   => api.put(`/facility/rooms/${id}`, d),
  deleteRoom:      (id)     => api.delete(`/facility/rooms/${id}`),
  // Schedules
  getSchedules:    (params) => api.get('/facility/schedules', { params }),
  createSchedule:  (d)      => api.post('/facility/schedules', d),
  updateSchedule:  (id,d)   => api.put(`/facility/schedules/${id}`, d),
  deleteSchedule:  (id)     => api.delete(`/facility/schedules/${id}`),
  bulkSeedSchedules:(d)     => api.post('/facility/schedules/bulk', d),
  generateRoutine: (weekStart, overwrite) => api.post('/facility/schedules/generate-routine', { weekStart, overwrite }),
  // Chat
  getMessages:     (params) => api.get('/facility/chat/messages', { params }),
  sendMessage:     (d)      => api.post('/facility/chat/send', d),
  getChatUsers:    ()       => api.get('/facility/chat/users'),
  getUnreadCounts: ()       => api.get('/facility/chat/unread'),
  markRoomRead:    (room)   => api.post('/facility/chat/read', { room }),
};

// ── LEAVES & TASKS ────────────────────────────────────────────────────
export const leavesAPI = {
  getAll:   (params) => api.get('/leavetasks/leaves', { params }),
  getToday: ()       => api.get('/leavetasks/leaves/today'),
  apply:    (d)      => api.post('/leavetasks/leaves', d),
  review:   (id,d)   => api.put(`/leavetasks/leaves/${id}/review`, d),
  cancel:   (id)     => api.put(`/leavetasks/leaves/${id}/cancel`),
};

export const tasksAPI = {
  getAll:   (params) => api.get('/leavetasks/tasks', { params }),
  create:   (d)      => api.post('/leavetasks/tasks', d),
  update:   (id,d)   => api.put(`/leavetasks/tasks/${id}`, d),
  delete:   (id)     => api.delete(`/leavetasks/tasks/${id}`),
};

// ── SALARY ────────────────────────────────────────────────────────────
export const salaryAPI = {
  getAll:      (params) => api.get('/salary', { params }),
  getMySummary:()       => api.get('/salary/my-summary'),
  attendancePreview: (employeeId, month, year) => api.get('/salary/attendance-preview', { params: { employeeId, month, year } }),
  generate:    (d)      => api.post('/salary/generate', d),
  bulkGenerate:(d)      => api.post('/salary/bulk', d),
  addExtraPayment: (d)  => api.post('/salary/extra-payment', d),
  credit:      (id,d)   => api.put(`/salary/${id}/credit`, d),
  update:      (id,d)   => api.put(`/salary/${id}`, d),
};
// ── APPOINTMENTS ─────────────────────────────────────
export const appointmentsAPI = {
  getAll:    (params)         => api.get('/appointments', { params }),
  getOne:    (id)             => api.get(`/appointments/${id}`),
  create:    (data)           => api.post('/appointments', data),
  update:    (id, data)       => api.put(`/appointments/${id}`, data),
  delete:    (id)             => api.delete(`/appointments/${id}`),
  getSlots:  (doctorId, date) => api.get(`/appointments/slots/${doctorId}/${date}`),
  confirm:   (id)             => api.put(`/appointments/${id}`, { status: 'confirmed' }),
  cancel:    (id, reason)     => api.put(`/appointments/${id}/cancel`, { reason }),
  complete:  (id, notes)      => api.put(`/appointments/${id}`, { status: 'completed', doctorNotes: notes }),
  getVideoRoom:   (id) => api.get(`/appointments/${id}/video`),
  startVideoCall: (id) => api.put(`/appointments/${id}/video/start`),
  endVideoCall:   (id) => api.put(`/appointments/${id}/video/end`),
  joinWaitlist:   (doctorId, date, notes) => api.post('/appointments/waitlist', { doctorId, date, notes }),
  getMyWaitlist:  ()   => api.get('/appointments/waitlist/mine'),
  leaveWaitlist:  (id) => api.delete(`/appointments/waitlist/${id}`),
  decideAdmission: (id, confirm, reason) => api.put(`/appointments/${id}/admission-decision`, { confirm, reason }),
  getAdmissionQueue: () => api.get('/appointments/admission-queue'),
};

// ── ALERTS ───────────────────────────────────────────
export const alertsAPI = {
  getAll:   (params)   => api.get('/alerts', { params }),
  create:   (data)     => api.post('/alerts', data),
  acknowledge: (id)    => api.put(`/alerts/${id}/acknowledge`),
  resolve:  (id, data) => api.put(`/alerts/${id}/resolve`, data),
  delete:   (id)       => api.delete(`/alerts/${id}`),
};

// ── PAYMENTS ─────────────────────────────────────────
export const paymentsAPI = {
  getAll:      (params) => api.get('/payments', { params }),
  getOne:      (id)     => api.get(`/payments/${id}`),
  createOrder: (data)   => api.post('/payments/create-order', data),
  verify:      (data)   => api.post('/payments/verify', data),
  simulate:    (data)   => api.post('/payments/simulate', data),
  initiate:    (data)   => api.post('/payments/initiate', data),
  confirm:     (data)   => api.post('/payments/confirm', data),
  createManualInvoice: (data) => api.post('/payments/manual-invoice', data),
};

// ── EXPENSES ─────────────────────────────────────────────────────────────
export const expenseAPI = {
  getAll:  (params)     => api.get('/expenses', { params }),
  create:  (data)       => {
    if (data instanceof FormData) return api.post('/expenses', data);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, v); });
    return api.post('/expenses', fd);
  },
  update:  (id, data)   => {
    if (data instanceof FormData) return api.put(`/expenses/${id}`, data);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, v); });
    return api.put(`/expenses/${id}`, fd);
  },
  remove:  (id)         => api.delete(`/expenses/${id}`),
};

// ── BUDGETS ──────────────────────────────────────────────────────────────
export const budgetAPI = {
  getAll:     (month, year) => api.get('/budgets', { params: { month, year } }),
  getSummary: (month, year) => api.get('/budgets/summary', { params: { month, year } }),
  upsert:     (data)        => api.post('/budgets', data),
  remove:     (id)          => api.delete(`/budgets/${id}`),
};

// ── NOTIFICATIONS (bell/inbox) ───────────────────────────────────────────
export const notificationsAPI = {
  getMine:        (params)  => api.get('/notifications', { params }),
  getUnreadCount: ()        => api.get('/notifications/unread-count'),
  markRead:       (id)      => api.put(`/notifications/${id}/read`),
  markAllRead:    ()        => api.put('/notifications/read-all'),
  remove:         (id)      => api.delete(`/notifications/${id}`),
};

// ── PRESCRIPTIONS (real, persisted) ──────────────────────────────────────
export const prescriptionAPI = {
  create:        (data) => api.post('/prescriptions', data),
  getMine:       ()      => api.get('/prescriptions/mine'),
  getIssued:     ()      => api.get('/prescriptions/issued'),
  getOne:        (id)    => api.get(`/prescriptions/${id}`),
};

// ── PRESCRIPTION REFILL REQUESTS ─────────────────────────────────────────
export const refillAPI = {
  create:      (data)              => api.post('/refill-requests', data),
  getMine:     ()                  => api.get('/refill-requests/mine'),
  getForReview:(params)            => api.get('/refill-requests/for-review', { params }),
  review:      (id, status, reviewNotes) => api.put(`/refill-requests/${id}/review`, { status, reviewNotes }),
};

// ── IPD ADMISSIONS & CONSOLIDATED DISCHARGE BILLING ──────────────────────
export const admissionAPI = {
  admit:          (data)   => api.post('/admissions', data),
  getAll:         (params) => api.get('/admissions', { params }),
  getMine:        ()       => api.get('/admissions/mine'),
  getBillPreview: (id)     => api.get(`/admissions/${id}/bill-preview`),
  discharge:      (id, data) => api.put(`/admissions/${id}/discharge`, data),
};

// ── SURGERY / OT SCHEDULING ────────────────────────────────────────────
export const surgeryAPI = {
  getAll:       (params) => api.get('/surgeries', { params }),
  getToday:     ()       => api.get('/surgeries/today'),
  getOne:       (id)     => api.get(`/surgeries/${id}`),
  schedule:     (data)   => api.post('/surgeries', data),
  updateChecklistItem: (id, itemIndex, checked) => api.put(`/surgeries/${id}/checklist`, { itemIndex, checked }),
  moveToPreOp:  (id)     => api.put(`/surgeries/${id}/move-to-pre-op`),
  start:        (id)     => api.put(`/surgeries/${id}/start`),
  complete:     (id, postOpNotes) => api.put(`/surgeries/${id}/complete`, { postOpNotes }),
  cancel:       (id, reason) => api.put(`/surgeries/${id}/cancel`, { reason }),
};

// ── PUBLIC (unauthenticated) — powers the marketing homepage ───────────
export const publicAPI = {
  getDoctors: () => api.get('/public/doctors'),
  getStats:   () => api.get('/public/stats'),
  getHospitalInfo: () => api.get('/public/hospital-info'),
};

// ── RADIOLOGY (RIS) ──────────────────────────────────────────────────────
export const radiologyAPI = {
  getOrders: (params) => api.get('/radiology/orders', { params }),
  getOrder:  (id) => api.get(`/radiology/orders/${id}`),
  createOrder: (data) => api.post('/radiology/orders', data),
  scheduleOrder: (id, scheduledAt) => api.put(`/radiology/orders/${id}/schedule`, { scheduledAt }),
  startOrder: (id) => api.put(`/radiology/orders/${id}/start`),
  completeOrder: (id, files) => {
    const fd = new FormData();
    (files || []).forEach(f => fd.append('images', f));
    return api.put(`/radiology/orders/${id}/complete`, fd);
  },
  submitReport: (id, findings, impression) => api.put(`/radiology/orders/${id}/report`, { findings, impression }),
  cancelOrder: (id, reason) => api.put(`/radiology/orders/${id}/cancel`, { reason }),
  deleteOrder: (id) => api.delete(`/radiology/orders/${id}`),
};

// ── DIALYSIS MANAGEMENT ──────────────────────────────────────────────────
export const dialysisAPI = {
  getSessions: (params) => api.get('/dialysis/sessions', { params }),
  getToday: () => api.get('/dialysis/sessions/today'),
  schedule: (data) => api.post('/dialysis/sessions', data),
  start: (id, vitals) => api.put(`/dialysis/sessions/${id}/start`, vitals),
  complete: (id, data) => api.put(`/dialysis/sessions/${id}/complete`, data),
  repeat: (id) => api.post(`/dialysis/sessions/${id}/repeat`),
  cancel: (id, reason, noShow) => api.put(`/dialysis/sessions/${id}/cancel`, { reason, noShow }),
};

// ── NABH COMPLIANCE ───────────────────────────────────────────────────────
export const nabhAPI = {
  getStandards: (all) => api.get('/nabh/standards', { params: all ? { all: 1 } : {} }),
  createStandard: (data) => api.post('/nabh/standards', data),
  updateStandard: (id, data) => api.put(`/nabh/standards/${id}`, data),
  deleteStandard: (id) => api.delete(`/nabh/standards/${id}`),
  getAudits: (params) => api.get('/nabh/audits', { params }),
  getAudit: (id) => api.get(`/nabh/audits/${id}`),
  createAudit: (data) => api.post('/nabh/audits', data),
  updateAuditItem: (id, data) => api.put(`/nabh/audits/${id}/item`, data),
  completeAudit: (id) => api.put(`/nabh/audits/${id}/complete`),
  getQualityIndicators: () => api.get('/nabh/quality-indicators'),
};
export const attendanceAPI = {
  checkIn:  (opts={}) => api.post('/attendance/check-in', opts),
  checkOut: (opts={}) => api.post('/attendance/check-out', opts),
  getMine:  (month)    => api.get('/attendance/mine', { params: month ? { month } : {} }),
  getAll:   (params)   => api.get('/attendance', { params }),
  override: (id, status, notes) => api.put(`/attendance/${id}/mark`, { status, notes }),
  enrollFace: (descriptor) => api.post('/attendance/face/enroll', { descriptor }),
  getFaceStatus: () => api.get('/attendance/face/status'),
  deleteFaceProfile: () => api.delete('/attendance/face'),
  submitLateRequest: (attendanceId, reason) => api.post('/attendance/late-request', { attendanceId, reason }),
  getLateRequests: (params) => api.get('/attendance/late-requests', { params }),
  decideLateRequest: (id, decision, adminNote) => api.put(`/attendance/late-requests/${id}/decide`, { decision, adminNote }),
};

// ── BILLING & INVOICING (GST) ──────────────────────────────────────────
export const invoiceAPI = {
  getAll:     (params) => api.get('/invoices', { params }),
  getOne:     (id)     => api.get(`/invoices/${id}`),
  create:     (data)   => api.post('/invoices', data),
  recordPayment: (id, amount, paymentMode) => api.put(`/invoices/${id}/pay`, { amount, paymentMode }),
  cancel:     (id, reason) => api.put(`/invoices/${id}/cancel`, { reason }),
  gstSummary: (params) => api.get('/invoices/gst-summary', { params }),
  getPackages:   (all) => api.get('/invoices/packages', { params: all ? { all: 1 } : {} }),
  createPackage: (data) => api.post('/invoices/packages', data),
  updatePackage: (id, data) => api.put(`/invoices/packages/${id}`, data),
  deletePackage: (id) => api.delete(`/invoices/packages/${id}`),
};

// ── CENTRAL INVENTORY & INDENTS ─────────────────────────────────────────
export const inventoryAPI = {
  getItems:    (params) => api.get('/inventory/items', { params }),
  createItem:  (data)   => api.post('/inventory/items', data),
  updateItem:  (id, data) => api.put(`/inventory/items/${id}`, data),
  stockIn:     (id, quantity, reason) => api.put(`/inventory/items/${id}/stock-in`, { quantity, reason }),
  adjustStock: (id, newQuantity, reason) => api.put(`/inventory/items/${id}/adjust`, { newQuantity, reason }),
  getLedger:   (id) => api.get(`/inventory/items/${id}/ledger`),

  getIndents:  (params) => api.get('/inventory/indents', { params }),
  createIndent:(data)   => api.post('/inventory/indents', data),
  reviewIndent:(id, decision, approvedQuantities, rejectionReason) => api.put(`/inventory/indents/${id}/review`, { decision, approvedQuantities, rejectionReason }),
  fulfillIndent:(id) => api.put(`/inventory/indents/${id}/fulfill`),
  cancelIndent: (id) => api.put(`/inventory/indents/${id}/cancel`),
};

// ── TPA & PRE-AUTHORIZATION ──────────────────────────────────────────────
export const tpaAPI = {
  getProviders:  (all) => api.get('/tpa/providers', { params: all ? { all: 1 } : {} }),
  createProvider:(data) => api.post('/tpa/providers', data),
  updateProvider:(id, data) => api.put(`/tpa/providers/${id}`, data),
  addRate:       (id, data) => api.post(`/tpa/providers/${id}/rates`, data),
  updateRate:    (id, rateId, data) => api.put(`/tpa/providers/${id}/rates/${rateId}`, data),
  deleteRate:    (id, rateId) => api.delete(`/tpa/providers/${id}/rates/${rateId}`),

  getPreAuths:   (params) => api.get('/tpa/pre-auth', { params }),
  createPreAuth: (data) => api.post('/tpa/pre-auth', data),
  respondToPreAuth: (id, decision, extra) => api.put(`/tpa/pre-auth/${id}/respond`, { decision, ...extra }),
  cancelPreAuth: (id) => api.put(`/tpa/pre-auth/${id}/cancel`),
};

// ── NURSE CALL SYSTEM ─────────────────────────────────────────────────────
export const nurseCallAPI = {
  create:       (reason)  => api.post('/nurse-calls', { reason }),
  getMine:      ()        => api.get('/nurse-calls/mine'),
  getActive:    ()        => api.get('/nurse-calls'),
  acknowledge:  (id)      => api.put(`/nurse-calls/${id}/acknowledge`),
  resolve:      (id)      => api.put(`/nurse-calls/${id}/resolve`),
};

// ── MAINTENANCE REQUESTS (facility issue reporting, any staff) ───────────
export const maintenanceRequestAPI = {
  create:   (data)   => api.post('/maintenance-requests', data),
  getAll:   (params) => api.get('/maintenance-requests', { params }),
  claim:    (id)      => api.put(`/maintenance-requests/${id}/claim`),
  resolve:  (id, resolutionNotes) => api.put(`/maintenance-requests/${id}/resolve`, { resolutionNotes }),
};

// ── SYSTEM HEALTH (IT technician / admin) ────────────────────────────────
export const systemAPI = {
  getHealth: () => api.get('/system/health'),
};

// ── HEALTH CERTIFICATES (fitness, medical leave, general) ────────────────
export const certificateAPI = {
  create:      (data) => api.post('/certificates', data),
  getMine:     ()      => api.get('/certificates/mine'),
  getIssued:   ()      => api.get('/certificates/issued'),
  getOne:      (id)    => api.get(`/certificates/${id}`),
};

// ── ORDERS ───────────────────────────────────────────
export const ordersAPI = {
  getAll:   (params)   => api.get('/orders', { params }),
  getOne:   (id)       => api.get(`/orders/${id}`),
  // `create` accepts either a plain object (no Rx needed) or a FormData
  // instance (when a prescription file is attached). Never set the
  // multipart Content-Type header manually — axios sets it (with the
  // required boundary) automatically when it sees a FormData body.
  create:   (data)     => api.post('/orders', data),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  cancel:   (id)       => api.put(`/orders/${id}/status`, { status: 'cancelled' }),
  dispatch: (id)       => api.put(`/orders/${id}/status`, { status: 'dispatched' }),
  deliver:  (id)       => api.put(`/orders/${id}/status`, { status: 'delivered' }),
};

// ── MEDICINES ────────────────────────────────────────
export const medicinesAPI = {
  getAll:      (params)   => api.get('/medicines', { params }),
  getOne:      (id)       => api.get(`/medicines/${id}`),
  create:      (data)     => api.post('/medicines', data),
  update:      (id, data) => api.put(`/medicines/${id}`, data),
  delete:      (id)       => api.delete(`/medicines/${id}`),
  updateStock: (id, qty)  => api.put(`/medicines/${id}`, { stock: qty }),
};

// ── REMINDERS ────────────────────────────────────────
export const remindersAPI = {
  getAll: () => api.get('/reminders'),
  create: (data) => api.post('/reminders', data),
  delete: (id) => api.delete(`/reminders/${id}`),
};
// ── ANALYTICS ────────────────────────────────────────
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics'),
  getStats:     () => api.get('/analytics'),
};

// ── ANNOUNCEMENTS ────────────────────────────────────
export const announcementsAPI = {
  getAll:   (params)   => api.get('/announcements', { params }),
  create:   (data)     => api.post('/announcements', data),
  pin:      (id)       => api.put(`/announcements/${id}/pin`),
  unpin:    (id)       => api.put(`/announcements/${id}/unpin`),
  update:   (id, data) => api.put(`/announcements/${id}`, data),
  delete:   (id)       => api.delete(`/announcements/${id}`),
  markRead: (id)       => api.put(`/announcements/${id}/read`),
};

// ── DAILY CHECKLIST (persists role-specific checklist ticks per day) ──
export const checklistAPI = {
  getToday: ()              => api.get('/checklist/today'),
  toggle:   (index, done)   => api.put('/checklist/today', { index, done }),
};

// ── STAFF LOGS (self-service requests/incidents: transport, supply,
//    incident reports, patrol logs — used by wardboy, security, etc.) ──
export const staffLogsAPI = {
  getAll:  (params) => api.get('/stafflogs', { params }),
  create:  (data)   => api.post('/stafflogs', data),
  resolve: (id, resolutionNotes) => api.put(`/stafflogs/${id}/resolve`, { resolutionNotes }),
  close:   (id, resolutionNotes) => api.put(`/stafflogs/${id}/close`, { resolutionNotes }),
  delete:  (id) => api.delete(`/stafflogs/${id}`),
};

// Admin-only: login/logout sessions, time spent, "what are they doing" feed
export const userActivityAPI = {
  overview:     ()       => api.get('/useractivity/overview'),
  sessions:     (userId) => api.get(`/useractivity/${userId}/sessions`),
  activity:     (userId) => api.get(`/useractivity/${userId}/activity`),
  myToday:      ()       => api.get('/useractivity/me/today'),
  mySessions:   ()       => api.get('/useractivity/me/sessions'),
  myActivity:   ()       => api.get('/useractivity/me/activity'),
};

// Real rating/review system — replaces the old fabricated "rating: 4.8"
export const reviewsAPI = {
  create:        (data)     => api.post('/reviews', data),
  forDoctor:      (doctorId) => api.get(`/reviews/doctor/${doctorId}`),
  myPending:      ()         => api.get('/reviews/mine'),
};

// ── HOSPITAL ENTRY VERIFICATION (OTP check-in: patient → reception →
//    room assignment → wardboy escort) ──
export const entryAPI = {
  getMine:          ()                    => api.get('/entry/mine'),
  getPending:       ()                    => api.get('/entry/pending'),
  verify:           (appointmentId, otp, bedLikely, flagNote)  => api.post('/entry/verify', { appointmentId, otp, bedLikely, flagNote }),
  assignRoom:       (id, roomId, notes, wardboyId) => api.put(`/entry/${id}/assign-room`, { roomId, notes, wardboyId }),
  getWardboyQueue:  ()                    => api.get('/entry/wardboy-queue'),
  acknowledge:      (id)                  => api.put(`/entry/${id}/acknowledge`),
  delete:           (id)                  => api.delete(`/entry/${id}`),
};

// Real ambulance trips — replaces the old hardcoded "3 trips today" sample
export const ambulanceTripsAPI = {
  getAll:  (params) => api.get('/ambulance-trips', { params }),
  create:  (data)   => api.post('/ambulance-trips', data),
  update:  (id,d)   => api.put(`/ambulance-trips/${id}`, d),
  request:      (data) => api.post('/ambulance-trips/request', data),
  getMine:      ()     => api.get('/ambulance-trips/mine'),
  accept:       (id)   => api.put(`/ambulance-trips/${id}/accept`),
  updateProgress: (id, status, cancelReason) => api.put(`/ambulance-trips/${id}/progress`, { status, cancelReason }),
};

// ── INSURANCE ────────────────────────────────────────────────────────
export const insuranceAPI = {
  getMyPolicies: () => api.get('/insurance/policies'),
  getPatientPolicies: (patientId) => api.get(`/insurance/policies/patient/${patientId}`),
  addPolicy: (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, v); });
    return api.post('/insurance/policies', fd);
  },
  deletePolicy: (id) => api.delete(`/insurance/policies/${id}`),
  getMyClaims: () => api.get('/insurance/claims/mine'),
  submitClaim: (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (k === 'documents' && Array.isArray(v)) { v.forEach(file => fd.append('documents', file)); return; }
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    });
    return api.post('/insurance/claims', fd);
  },
  getAllClaims: (params) => api.get('/insurance/claims', { params }),
  reviewClaim: (id, status, approvedAmount, reviewNotes) => api.put(`/insurance/claims/${id}/review`, { status, approvedAmount, reviewNotes }),
  markClaimPaid: (id) => api.put(`/insurance/claims/${id}/pay`),
};

// ── MEDICATION ADMINISTRATION (MAR) ───────────────────────────────────
export const medicationAPI = {
  createSchedule: (data) => api.post('/medications/schedules', data),
  getPatientSchedules: (patientId) => api.get(`/medications/schedules/${patientId}`),
  discontinueSchedule: (id) => api.put(`/medications/schedules/${id}/discontinue`),
  getTodayDue: () => api.get('/medications/today'),
  logDose: (scheduleId, doseTime, status, notes) => api.post('/medications/log', { scheduleId, doseTime, status, notes }),
};

// ── WALK-IN QUEUE ──────────────────────────────────────────────────────
export const queueAPI = {
  getQueue: (params) => api.get('/queue', { params }),
  createToken: (data) => api.post('/queue', data),
  updateStatus: (id, status) => api.put(`/queue/${id}/status`, { status }),
  getMine: () => api.get('/queue/mine'),
  getPublicBoard: () => api.get('/queue/public/board'),
};

// ── WARD/BED TRANSFERS ─────────────────────────────────────────────────
export const transferAPI = {
  getAll: () => api.get('/transfers'),
  create: (data) => api.post('/transfers', data),
  accept: (id) => api.put(`/transfers/${id}/accept`),
  updateProgress: (id, status) => api.put(`/transfers/${id}/progress`, { status }),
};

// Doctor seating area — patient sees this right after booking; admin sees full layout
export const doctorCabinsAPI = {
  getAll:        (params)  => api.get('/doctor-cabins', { params }),
  getForDoctor:  (doctorId)=> api.get(`/doctor-cabins/by-doctor/${doctorId}`),
  upsert:        (data)    => api.post('/doctor-cabins', data),
  delete:        (id)      => api.delete(`/doctor-cabins/${id}`),
};

// General hospital feedback (distinct from per-appointment doctor reviews)
export const feedbackAPI = {
  create:   (data)   => api.post('/feedback', data),
  mine:     ()        => api.get('/feedback/mine'),
  getAll:   (params)  => api.get('/feedback', { params }),
  respond:  (id,d)    => api.put(`/feedback/${id}`, d),
};

// Floating 🐞 "Report a Bug" widget — visible to every logged-in role
export const bugReportsAPI = {
  create: (data)   => {
    if (data instanceof FormData) return api.post('/bugs', data);
    const fd = new FormData();
    Object.entries(data).forEach(([k,v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
    return api.post('/bugs', fd);
  },
  getAll: (params) => api.get('/bugs', { params }),
  update: (id,d)   => api.put(`/bugs/${id}`, d),
};

// Admin-only accountability trail — who did what, to what, when
export const auditLogAPI = {
  getAll: (params) => api.get('/audit-log', { params }),
};

// Family Access — patient managing a dependent's health data
export const familyAPI = {
  getMine: ()        => api.get('/family'),
  add:     (data)    => api.post('/family', data),
  loginAs: (linkId)  => api.post(`/family/${linkId}/login-as`),
  remove:  (linkId)  => api.delete(`/family/${linkId}`),
};

// Discharge Timeline — recovery/follow-up milestones
export const dischargePlanAPI = {
  getMine:       ()            => api.get('/discharge-plans/mine'),
  getForPatient: (patientId)   => api.get(`/discharge-plans/patient/${patientId}`),
  create:        (data)        => api.post('/discharge-plans', data),
  updateMilestone: (planId, milestoneId, status) => api.put(`/discharge-plans/${planId}/milestones/${milestoneId}`, { status }),
};

// Wearable Sync — manual entry + real Fitbit OAuth
export const wearableAPI = {
  getMine:      ()     => api.get('/wearable'),
  addEntry:     (data) => api.post('/wearable', data),
  importCsv:    (csv)  => api.post('/wearable/import', { csv }),
  fitbitConnect:()     => api.get('/wearable/fitbit/connect'),
  fitbitSync:   ()     => api.post('/wearable/fitbit/sync'),
  googleFitConnect: () => api.get('/wearable/google-fit/connect'),
  googleFitSync:    () => api.post('/wearable/google-fit/sync'),
  // Nurse/doctor: bedside vitals for a specific patient
  getForPatient:    (patientId) => api.get(`/wearable/patient/${patientId}`),
  recordForPatient: (patientId, data) => api.post(`/wearable/patient/${patientId}`, data),
};

// Peer Consultation — anonymized second-opinion sharing between doctors
export const peerConsultAPI = {
  getSent:        () => api.get('/peer-consults/sent'),
  getReceived:    () => api.get('/peer-consults/received'),
  getSpecialists: () => api.get('/peer-consults/specialists'),
  create:         (data) => api.post('/peer-consults', data),
  respond:        (id, response) => api.put(`/peer-consults/${id}/respond`, { response }),
};

// Research Hub — live PubMed feed filtered by specialty
export const researchHubAPI = {
  getFeed: (query) => api.get('/research-hub', { params: query ? { query } : {} }),
};

// Cross-Interaction Alerts — drug interaction + allergy checking
export const drugCheckAPI = {
  check: (medicines, patientId) => api.post('/drug-check', { medicines, patientId }),
};

// Predictive Staffing — trend-based patient volume forecast
export const staffingAPI = {
  getForecast: () => api.get('/staffing/forecast'),
};

// Asset Tracking — manual equipment location registry
export const assetsAPI = {
  getAll: (params)  => api.get('/assets', { params }),
  getMine: ()       => api.get('/assets/mine'),
  getDueForService: () => api.get('/assets/due-service'),
  create: (data)    => api.post('/assets', data),
  update: (id, data)=> api.put(`/assets/${id}`, data),
  checkout: (id, location, note) => api.put(`/assets/${id}/checkout`, { location, note }),
  checkin: (id, location) => api.put(`/assets/${id}/checkin`, { location }),
  markServiced: (id, nextServiceDue, notes) => api.put(`/assets/${id}/service`, { nextServiceDue, notes }),
  delete: (id)       => api.delete(`/assets/${id}`),
};

// ── VISITOR / GATE PASS MANAGEMENT ──────────────────────────────────────
export const visitorAPI = {
  getAll:  (params) => api.get('/visitors', { params }),
  checkIn: (data)    => api.post('/visitors', data),
  checkOut:(id)      => api.put(`/visitors/${id}/checkout`),
};

// Sentiment Analytics — keyword-based feedback sentiment report
export const sentimentAPI = {
  getReport: () => api.get('/sentiment'),
};

// IoT Fridge Monitor — manual temperature logging with alerts
export const fridgeAPI = {
  getAll:     () => api.get('/fridge-logs'),
  addReading: (data) => api.post('/fridge-logs', data),
};

// Handover Protocol — shift handover checklist
export const handoverAPI = {
  getForRole:    (role) => api.get('/handovers', { params: role ? { role } : {} }),
  create:        (data) => api.post('/handovers', data),
  acknowledge:   (id)   => api.put(`/handovers/${id}/acknowledge`),
};

// Smart Triaging — color-coded priority queue
export const triageAPI = {
  getQueue: () => api.get('/triage/queue'),
};

// Feedback Generator — admin-built custom surveys targeted at specific dashboards
export const feedbackFormsAPI = {
  getAll:     ()        => api.get('/feedback-forms'),
  create:     (data)    => api.post('/feedback-forms', data),
  update:     (id, data)=> api.put(`/feedback-forms/${id}`, data),
  delete:     (id)      => api.delete(`/feedback-forms/${id}`),
  getResults: (id)      => api.get(`/feedback-forms/${id}/results`),
  getMine:    ()        => api.get('/feedback-forms/mine'),
  respond:    (id, answers) => api.post(`/feedback-forms/${id}/respond`, { answers }),
};

// Blood Bank — inventory + donation lifecycle + certificate download
export const bloodBankAPI = {
  getInventory:   ()             => api.get('/blood-bank/inventory'),
  updateInventory:(group, units) => api.put(`/blood-bank/inventory/${group}`, { units }),
  getEligibility: ()             => api.get('/blood-bank/eligibility'),
  donate:         (data)         => api.post('/blood-bank/donate', data),
  getMyDonations: ()             => api.get('/blood-bank/donations/mine'),
  getAllDonations:(params)       => api.get('/blood-bank/donations', { params }),
  updateStatus:   (id, status, rejectionReason, extra) => api.put(`/blood-bank/donations/${id}/status`, { status, rejectionReason, ...extra }),
  complete:       (id, unitsCollected) => api.put(`/blood-bank/donations/${id}/complete`, { unitsCollected }),
  // Certificate is a PDF stream, not JSON — use the raw axios instance
  // with responseType 'blob' so the browser can open/download it.
  getCertificateUrl: (id) => `${api.defaults.baseURL}/blood-bank/donations/${id}/certificate`,
  getCertificateBlob: (id) => api.get(`/blood-bank/donations/${id}/certificate`, { responseType: 'blob' }),
};

// Hospital Config — real hospital name/signatory used on certificates
export const hospitalConfigAPI = {
  get:    ()     => api.get('/hospital-config'),
  update: (data) => {
    if (data instanceof FormData) return api.put('/hospital-config', data);
    const fd = new FormData();
    Object.entries(data).forEach(([k,v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
    return api.put('/hospital-config', fd);
  },
};
