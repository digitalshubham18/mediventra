const Appointment = require('../models/Appointment');
const User        = require('../models/User');
const Leave       = require('../models/Leave');
const Payment     = require('../models/Payment');
const emailService = require('../utils/emailService');
const smsService   = require('../utils/smsService');
const { notifyWaitlistForSlot } = require('./waitlistController');
const { notify } = require('../utils/notify');
const crypto       = require('crypto');

// Utility: turn a "09:00 AM" / "02:30 PM" style timeSlot into a real Date
// on the given day, so it can be compared against "now". Returns null if
// the slot string can't be parsed (caller should fail open in that case
// rather than block a legitimate booking on a formatting quirk).
function slotToDateTime(apptDate, timeSlot) {
  if (!timeSlot) return null;
  const m = String(timeSlot).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let [, hh, mm, ap] = m;
  hh = parseInt(hh, 10);
  mm = parseInt(mm, 10);
  if (ap.toUpperCase() === 'PM' && hh !== 12) hh += 12;
  if (ap.toUpperCase() === 'AM' && hh === 12) hh = 0;
  const d = new Date(apptDate);
  d.setHours(hh, mm, 0, 0);
  return d;
}
exports.slotToDateTime = slotToDateTime; // exported for unit tests

// Utility: check if doctor is on approved leave on given date
async function isDoctorOnLeave(doctorId, date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const leave = await Leave.findOne({
    user:   doctorId,
    status: 'approved',
    from:   { $lte: d },
    to:     { $gte: d },
  });
  return leave || null;
}

// GET all appointments
exports.getAppointments = async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'patient')     query.patient = req.user.id;
    else if (req.user.role === 'doctor') query.doctor  = req.user.id;
    if (req.query.status)     query.status     = req.query.status;
    if (req.query.department) query.department = req.query.department;
    if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const p = req.query.date.split('-').map(Number);
      const dayStart = new Date(p[0], p[1]-1, p[2], 0, 0, 0, 0);
      const dayEnd   = new Date(p[0], p[1]-1, p[2], 23, 59, 59, 999);
      query.date = { $gte: dayStart, $lte: dayEnd };
    }
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const appts = await Appointment.find(query)
      .populate('patient', 'name email phone bloodGroup age')
      .populate('doctor',  'name specialization department rating')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Appointment.countDocuments(query);
    res.json({ success: true, count: appts.length, total, pages: Math.ceil(total / limit), data: appts });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// POST create appointment
exports.createAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, department, type, notes, symptoms, fee, consultMode } = req.body;

    // Every booking must include all of these — no partially-filled
    // appointments. (department/type can have sane defaults so they're not
    // required client-side, but the doctor, date, slot, and the reason for
    // the visit must always be provided.)
    const missing = [];
    if (!doctorId)            missing.push('doctor');
    if (!date)                missing.push('date');
    if (!timeSlot)            missing.push('time slot');
    if (!department)          missing.push('department');
    if (!notes || !notes.trim()) missing.push('reason for visit');
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0 || symptoms.every(s => !s || !s.trim())) {
      missing.push('symptoms');
    }
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Please fill in all required fields: ${missing.join(', ')}.` });
    }

    // 1. Doctor exists?
    // Normalize date to midnight UTC to avoid timezone drift
    let apptDate;
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const p = date.split('-').map(Number);
      // Use LOCAL midnight (matches getAvailableSlots day-range calc) for consistent matching
      apptDate = new Date(p[0], p[1]-1, p[2], 0, 0, 0, 0);
    } else {
      apptDate = new Date(date);
    }
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor')
      return res.status(404).json({ success: false, error: 'Doctor not found' });

    // 1b. Already have ANY unfinished appointment — with this doctor or any
    // other? A patient shouldn't be able to hold multiple open bookings at
    // once across the hospital; they need to see the current one through
    // (completed/cancelled/no-show) before booking a new one with anyone.
    const openAny = await Appointment.findOne({
      patient: req.user.id,
      status: { $in: ['pending', 'confirmed'] },
    }).populate('doctor', 'name');
    if (openAny) {
      const samePerson = String(openAny.doctor?._id) === String(doctorId);
      return res.status(400).json({
        success: false,
        error: samePerson
          ? `Your previous appointment with Dr. ${doctor.name} is not complete yet. After it's completed, you can book another one.`
          : `You already have an open appointment with Dr. ${openAny.doctor?.name || 'another doctor'} on ${new Date(openAny.date).toLocaleDateString('en-IN')} at ${openAny.timeSlot}. Please complete or cancel it before booking a new appointment.`,
        previousAppointmentPending: true,
        previousAppointmentId: openAny._id,
      });
    }

    // 1c. Same-day booking must be at least 1 hour from right now — walk-in
    // slots 10 minutes out aren't realistically bookable/preparable.
    const now = new Date();
    const isToday = apptDate.getFullYear() === now.getFullYear() &&
                     apptDate.getMonth()    === now.getMonth() &&
                     apptDate.getDate()     === now.getDate();
    if (isToday) {
      const slotDateTime = slotToDateTime(apptDate, timeSlot);
      if (slotDateTime && (slotDateTime.getTime() - now.getTime()) < 60 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: `For today's bookings, please choose a time at least 1 hour from now (current time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}).`,
          tooSoon: true,
        });
      }
    }

    // 2. Doctor on leave on that date?
    const leave = await isDoctorOnLeave(doctorId, date);
    if (leave) {
      return res.status(400).json({
        success: false,
        error: `Dr. ${doctor.name} is on ${leave.type} leave on this date and is unavailable. Please choose another doctor or date.`,
        doctorAbsent: true,
        doctorName: doctor.name,
      });
    }

    // 3. Time slot already booked? (block double booking)
    const dayStart = apptDate;
    const dayEnd   = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate(), 23, 59, 59, 999);
    const existing = await Appointment.findOne({
      doctor:   doctorId,
      timeSlot,
      date:     { $gte: dayStart, $lte: dayEnd },
      status:   { $in: ['pending', 'confirmed'] },
    });
    if (existing)
      return res.status(400).json({
        success: false,
        error:   `The ${timeSlot} slot with Dr. ${doctor.name} is already booked. Please select another time.`,
        slotTaken: true,
      });

    // 4. Create
    const appointment = await Appointment.create({
      patient:    req.user.id,
      doctor:     doctorId,
      date:       apptDate,
      timeSlot,
      department,
      type:       type    || 'Consultation',
      reason:     notes   || '',
      notes:      notes   || '',
      symptoms:   symptoms || [],
      fee:        fee || 500,
      paid:       false,
      status:     'pending',
      consultMode: consultMode === 'video' ? 'video' : 'in-person',
    });
    await appointment.populate('patient', 'name email phone');
    await appointment.populate('doctor',  'name specialization department');

    const io = req.app.get('io');
    if (io) io.emit('new_appointment', {
      appointmentId: appointment._id,
      patient: appointment.patient.name,
      doctor:  appointment.doctor.name,
      date, timeSlot,
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/appointments/:id/admission-decision — doctor confirms or declines
// a possible admission (either one reception flagged at check-in, or one the
// doctor is raising themselves after examining the patient — bedLikely from
// reception is advisory only, doctor's word is final).
exports.decideAdmission = async (req, res) => {
  try {
    const { confirm, reason } = req.body;
    const appt = await Appointment.findById(req.params.id).populate('patient', 'name');
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    if (String(appt.doctor) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only the treating doctor can decide on admission' });
    }
    if (confirm && (!reason || !reason.trim())) {
      return res.status(400).json({ success: false, error: 'Please give a reason for admission' });
    }

    if (confirm) {
      appt.admission.status = 'confirmed';
      appt.admission.confirmedBy = req.user.id;
      appt.admission.confirmedAt = new Date();
      appt.admission.reason = reason.trim();
    } else {
      appt.admission.status = 'declined';
      appt.admission.declinedAt = new Date();
    }
    await appt.save();

    if (confirm) {
      const receptionists = await User.find({ role: 'receptionist', status: 'approved' }).select('_id');
      for (const r of receptionists) {
        await notify(req, r._id, {
          type: 'admission_confirmed', title: '🛏️ Bed needed — ready to assign',
          message: `Dr. confirmed admission for ${appt.patient.name}: ${reason.trim()}`,
          link: '/dashboard', icon: '🛏️',
        });
      }
      const io = req.app.get('io');
      if (io) io.emit('admission_confirmed', { appointmentId: appt._id, patientName: appt.patient.name });
    }

    res.json({ success: true, data: appt });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/appointments/admission-queue — reception's actionable list: bed
// requests a doctor has confirmed (need a room now) plus ones only flagged
// so far (awaiting doctor confirmation, shown for visibility).
exports.getAdmissionQueue = async (req, res) => {
  try {
    const appts = await Appointment.find({ 'admission.status': { $in: ['flagged', 'confirmed'] } })
      .populate('patient', 'name phone age bloodGroup')
      .populate('doctor', 'name specialization department')
      .sort({ 'admission.confirmedAt': -1, 'admission.flaggedAt': -1 });
    res.json({ success: true, data: appts });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};


// PUT update appointment
exports.updateAppointment = async (req, res) => {
  try {
    let appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    if (req.body.status === 'confirmed' && !['doctor','admin','receptionist'].includes(req.user.role))
      return res.status(403).json({ success: false, error: 'Not authorized to confirm appointments' });

    // Completing a visit requires a real consultation summary — the doctor
    // must record what was prescribed/advised, and explicitly decide
    // whether a follow-up is needed, rather than just flipping a status flag.
    if (req.body.status === 'completed' && appt.status !== 'completed') {
      if (!['doctor','admin'].includes(req.user.role))
        return res.status(403).json({ success: false, error: 'Only the doctor (or admin) can mark an appointment completed' });

      const medicines    = req.body.consultation?.medicines?.trim();
      const instructions = req.body.consultation?.instructions?.trim();
      if (!medicines || !instructions) {
        return res.status(400).json({ success: false, error: 'Please add what medicine is required and what the patient should/should not do before completing this appointment.' });
      }
      const followUpRequired = !!req.body.followUp?.required;
      if (followUpRequired && !req.body.followUp?.date) {
        return res.status(400).json({ success: false, error: 'Please pick a follow-up date, or mark complete without scheduling one.' });
      }

      req.body.consultation = { medicines, instructions, completedAt: new Date() };
    }

    appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('patient', 'name email phone').populate('doctor', 'name specialization department');

    // A confirmed video consultation is exactly the kind of thing a
    // patient needs to know about immediately, with the exact date/time
    // — same idea as the blood-donation scheduling notification.
    if (req.body.status === 'confirmed' && appt.consultMode === 'video') {
      const dateStr = new Date(appt.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${appt.patient._id}`).emit('video_call_scheduled', {
          appointmentId: appt._id, doctorName: appt.doctor.name,
          date: appt.date, dateStr, timeSlot: appt.timeSlot,
          message: `Dr. ${appt.doctor.name} confirmed your video consultation for ${dateStr} at ${appt.timeSlot}.`,
        });
        await notify(req, appt.patient._id, { type:'video_call_scheduled', title:'📹 Video consultation confirmed', message:`Dr. ${appt.doctor.name} — ${dateStr} at ${appt.timeSlot}`, link:'/appointments', icon:'📹' });
      }
      if (appt.patient?.phone) {
        smsService.sendSMS({
          to: appt.patient.phone,
          body: `Mediventra: Dr. ${appt.doctor.name} confirmed your video consultation for ${dateStr} at ${appt.timeSlot}. Join from the Appointments page at that time.`,
        }).catch(console.error);
      }
    }

    // Auto-create the actual follow-up appointment (pending — patient still
    // confirms/pays) instead of just storing an intention.
    if (req.body.status === 'completed' && appt.followUp?.required && appt.followUp?.date && !appt.followUp?.appointment) {
      // First 2 follow-ups with the SAME doctor are free — a real hospital
      // courtesy for post-visit check-ins. From the 3rd follow-up onward,
      // the normal consultation fee applies and payment is required
      // before the visit is confirmed, same as any other appointment.
      const priorFollowUpCount = await Appointment.countDocuments({
        patient: appt.patient._id, doctor: appt.doctor._id, type: 'Follow-up',
      });
      const isFree = priorFollowUpCount < 2;

      const followAppt = await Appointment.create({
        patient: appt.patient._id, doctor: appt.doctor._id,
        date: new Date(appt.followUp.date), timeSlot: '10:00 AM',
        department: appt.department, type: 'Follow-up',
        reason: `Follow-up to visit on ${new Date(appt.date).toLocaleDateString('en-IN')}`,
        notes: appt.followUp.notes || `Follow-up requested by Dr. ${appt.doctor.name}`,
        symptoms: [],
        fee: isFree ? 0 : appt.fee,
        paid: isFree,
        paymentStatus: isFree ? 'paid' : 'pending',
        // Free follow-ups need no payment step, so there's nothing left for
        // the patient (or front desk) to confirm — go straight to confirmed.
        status: isFree ? 'confirmed' : 'pending',
      });
      appt.followUp.appointment = followAppt._id;
      await appt.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('appointment_updated', { appointmentId: appt._id, status: appt.status, patient: appt.patient.name });
      if (req.body.status === 'completed') {
        // Tell the patient their visit is done — this is what triggers the
        // "Rate your visit" prompt on their dashboard.
        io.to(`user_${appt.patient._id}`).emit('appointment_completed', {
          appointmentId: appt._id, doctorName: appt.doctor.name,
          followUpScheduled: !!appt.followUp?.appointment,
        });
        await notify(req, appt.patient._id, { type:'appointment_completed', title:'✅ Visit completed', message:`Your appointment with Dr. ${appt.doctor.name} is complete${appt.followUp?.appointment ? '. A follow-up has been scheduled.' : '.'}`, link:'/appointments', icon:'✅' });
      }
    }
    res.json({ success: true, data: appt });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET available slots — marks doctor-on-leave days
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const ALL_SLOTS = [
      '09:00 AM','09:30 AM','10:00 AM','10:30 AM',
      '11:00 AM','11:30 AM','12:00 PM',
      '02:00 PM','02:30 PM','03:00 PM','03:30 PM',
      '04:00 PM','04:30 PM','05:00 PM',
    ];

    // Check doctor leave
    const leave = await isDoctorOnLeave(doctorId, date);
    if (leave) {
      const doctor = await User.findById(doctorId).select('name');
      return res.json({
        success: true,
        data: { available: [], booked: ALL_SLOTS, doctorOnLeave: true,
                leaveType: leave.type, doctorName: doctor?.name },
      });
    }

    // Timezone-safe: parse YYYY-MM-DD as local midnight
    const parts = date.split('-').map(Number);
    const dayStart = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0, 0);
    const dayEnd   = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59, 999);
    const booked = await Appointment.find({
      doctor:  doctorId,
      date:    { $gte: dayStart, $lte: dayEnd },
      status:  { $in: ['pending','confirmed'] },
    }).select('timeSlot');

    const bookedSlots = booked.map(a => a.timeSlot);
    let available = ALL_SLOTS.filter(s => !bookedSlots.includes(s));

    // Same-day rule: don't even offer a slot less than 1 hour from now.
    const now = new Date();
    const isToday = dayStart.getFullYear() === now.getFullYear() &&
                     dayStart.getMonth()    === now.getMonth() &&
                     dayStart.getDate()     === now.getDate();
    if (isToday) {
      available = available.filter(s => {
        const dt = slotToDateTime(dayStart, s);
        return !dt || (dt.getTime() - now.getTime()) >= 60 * 60 * 1000;
      });
    }

    res.json({ success: true, data: { available, booked: bookedSlots, doctorOnLeave: false } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// DELETE appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    await appt.deleteOne();
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── PUT /api/appointments/:id/cancel ────────────────────────────────────
// Cancels an appointment and, if it was paid for, automatically refunds the
// payment back to the original payment method within 24 hours, emailing
// the patient a refund confirmation. This is the single entry point for
// cancellation from any role (patient, receptionist, doctor, admin) so the
// refund logic only lives in one place.
const cancelEmailHTML = (patient, appt, payment, reason) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#dc2626,#f87171);padding:30px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">📅❌</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Appointment Cancelled</h1>
  <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">Mediventra Hospital Management System</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:19px;margin:0 0 10px">Dear ${patient.name},</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 20px">Your appointment has been cancelled${reason ? ` — <em>${reason}</em>` : ''}. Details below:</p>
  <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:16px;padding:20px;margin-bottom:20px">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[['📅 Date', new Date(appt.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],['⏰ Time', appt.timeSlot],['🏥 Type', appt.type||'Consultation']].map(([l,v])=>`
      <tr><td style="padding:7px 0;color:#991b1b;font-size:13px;width:120px">${l}</td><td style="padding:7px 0;color:#0f172a;font-weight:700;font-size:13px">${v}</td></tr>`).join('')}
    </table>
  </div>
  ${payment ? `
  <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:20px">
    <h3 style="color:#15803d;font-size:15px;margin:0 0 10px">💰 Refund Initiated</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[['Amount','₹'+payment.refundAmount],['Refund to', payment.method==='card'?`${payment.cardBrand} card ending ${payment.cardLast4}`:payment.method==='upi'?'Original UPI ID':payment.method==='netbanking'?'Original bank account':payment.method?.toUpperCase()],['Refund ID', payment.refundId],['Expected by', payment.refundETA ? new Date(payment.refundETA).toLocaleString('en-IN',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}) : 'within 24 hours']].map(([l,v])=>`
      <tr><td style="padding:7px 0;color:#15803d;font-size:13px;width:120px">${l}</td><td style="padding:7px 0;color:#0f172a;font-weight:700;font-size:13px;font-family:${l.includes('ID')?'monospace':'inherit'}">${v}</td></tr>`).join('')}
    </table>
    <p style="color:#15803d;font-size:12.5px;margin:12px 0 0">✅ Your refund will be credited back to the same payment method automatically — no action needed from you.</p>
  </div>` : ''}
  <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">You're welcome to book a new appointment any time from your dashboard.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;

exports.cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('patient', 'name email notificationPrefs')
      .populate('doctor', 'name');
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });

    // Authorization: the patient who owns it, or staff who can manage appointments
    const isOwner = appt.patient._id.toString() === req.user.id;
    if (!isOwner && !['admin', 'receptionist', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this appointment' });
    }
    if (appt.status === 'cancelled') return res.status(400).json({ success: false, error: 'Appointment is already cancelled' });
    if (appt.status === 'completed') return res.status(400).json({ success: false, error: 'Completed appointments cannot be cancelled' });

    const reason = req.body.reason || '';
    appt.status = 'cancelled';
    appt.cancelReason = reason;
    await appt.save();

    // ── Auto-refund if this appointment was paid for ──────────────────
    let payment = await Payment.findOne({ appointment: appt._id, status: 'success' });
    if (payment) {
      const refundId = 'RFND' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
      const refundETA = new Date(Date.now() + 24 * 60 * 60 * 1000); // within 24 hours, same method

      // If real Razorpay keys are configured, issue a real refund via the
      // gateway (refunds always return to the original payment method —
      // this is a Razorpay platform guarantee, not something we choose).
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
          !process.env.RAZORPAY_KEY_ID.includes('REPLACE') && payment.razorpayPaymentId) {
        try {
          const Razorpay = require('razorpay');
          const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
          const rzpRefund = await rzp.payments.refund(payment.razorpayPaymentId, { amount: Math.round(payment.amount * 100) });
          payment.refundId = rzpRefund.id;
        } catch (rzpErr) {
          console.error('Razorpay refund failed, falling back to recorded refund:', rzpErr.message);
          payment.refundId = refundId;
        }
      } else {
        // Demo mode — record the refund as if the gateway processed it
        payment.refundId = refundId;
      }

      payment.status = 'refunded';
      payment.refundAmount = payment.amount;
      payment.refundedAt = new Date();
      payment.refundETA = refundETA;
      payment.refundReason = reason || 'Appointment cancelled';
      await payment.save();
      appt.paymentStatus = 'refunded';
      await appt.save();

      if (appt.patient?.email) {
        emailService.sendGeneral({
          to: appt.patient.email,
          subject: `❌ Appointment Cancelled — Refund Initiated | Mediventra`,
          html: cancelEmailHTML(appt.patient, appt, payment, reason),
        }).catch(console.error);
      }
    } else if (appt.patient?.email && emailService.shouldEmail(appt.patient, 'appointments')) {
      // No payment to refund, but still notify of cancellation
      emailService.sendGeneral({
        to: appt.patient.email,
        subject: `❌ Appointment Cancelled | Mediventra`,
        html: cancelEmailHTML(appt.patient, appt, null, reason),
      }).catch(console.error);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('appointment_updated', { appointmentId: appt._id, status: 'cancelled', patient: appt.patient.name });
      if (payment) io.to(`user_${appt.patient._id}`).emit('refund_initiated', { appointmentId: appt._id, amount: payment.refundAmount, refundId: payment.refundId });
    }

    // A slot just freed up — let anyone waitlisted for this doctor/date know.
    notifyWaitlistForSlot(req, appt.doctor._id, appt.date, appt.timeSlot).catch(() => {});

    res.json({ success: true, data: appt, refund: payment ? { amount: payment.refundAmount, refundId: payment.refundId, eta: payment.refundETA } : null });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Video Consultation ─────────────────────────────────────────────────
// The actual call is peer-to-peer WebRTC (signaled over the socket.io
// relay in server.js) — these two endpoints just gate who's allowed to
// join a given appointment's video room, and log when the call actually
// happened for the record.
async function getAuthorizedVideoAppointment(req, res) {
  const appt = await Appointment.findById(req.params.id).populate('patient', 'name').populate('doctor', 'name');
  if (!appt) { res.status(404).json({ success: false, error: 'Appointment not found' }); return null; }
  const isParticipant = appt.patient._id.toString() === req.user.id || appt.doctor._id.toString() === req.user.id;
  if (!isParticipant && req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Not authorized for this video call' }); return null;
  }
  if (appt.consultMode !== 'video') {
    res.status(400).json({ success: false, error: 'This appointment isn\u2019t booked as a video consultation' }); return null;
  }
  if (appt.status !== 'confirmed') {
    res.status(400).json({ success: false, error: 'This appointment needs to be confirmed by the doctor before the video call can start.' }); return null;
  }
  return appt;
}

// GET /api/appointments/:id/video — fetch the room id to join, if allowed
exports.getVideoRoom = async (req, res) => {
  try {
    const appt = await getAuthorizedVideoAppointment(req, res);
    if (!appt) return;
    res.json({ success: true, data: { roomId: appt.videoRoomId, patientName: appt.patient.name, doctorName: appt.doctor.name } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/appointments/:id/video/start
exports.startVideoCall = async (req, res) => {
  try {
    const appt = await getAuthorizedVideoAppointment(req, res);
    if (!appt) return;
    if (!appt.videoCallStartedAt) { appt.videoCallStartedAt = new Date(); await appt.save(); }
    res.json({ success: true, data: appt });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/appointments/:id/video/end
exports.endVideoCall = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
    appt.videoCallEndedAt = new Date();
    await appt.save();
    res.json({ success: true, data: appt });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
