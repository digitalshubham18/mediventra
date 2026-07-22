const EntryVerification = require('../models/EntryVerification');
const OTRoom             = require('../models/OTRoom');
const Appointment         = require('../models/Appointment');
const User               = require('../models/User');
const emailService       = require('../utils/emailService');
const smsService         = require('../utils/smsService');
const { notify }         = require('../utils/notify');

const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// Haversine distance in meters between two lat/lng points
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// POST /api/entry/geofence-checkin — { appointmentId, lat, lng }
// Real GPS-based auto check-in: the patient's OWN device reports its
// current coordinates (via the browser's Geolocation API — genuinely
// real, not simulated), and if they're within the configured radius of
// the hospital, their entry is verified automatically without needing a
// receptionist or the OTP. Requires HOSPITAL_LAT / HOSPITAL_LNG /
// CHECKIN_RADIUS_METERS in .env — without those configured, it tells
// the caller clearly rather than silently failing.
exports.geofenceCheckIn = async (req, res) => {
  try {
    const { HOSPITAL_LAT, HOSPITAL_LNG, CHECKIN_RADIUS_METERS } = process.env;
    if (!HOSPITAL_LAT || !HOSPITAL_LNG) {
      return res.status(400).json({ success: false, error: 'Geofenced check-in isn\u2019t configured yet — set HOSPITAL_LAT / HOSPITAL_LNG in the backend .env.' });
    }
    const { appointmentId, lat, lng } = req.body;
    if (!appointmentId || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, error: 'appointmentId, lat, and lng are required' });
    }

    const entry = await EntryVerification.findOne({ appointment: appointmentId, patient: req.user.id }).populate('patient', 'name').populate('appointment', 'date');
    if (!entry) return res.status(404).json({ success: false, error: 'No entry record found for this appointment' });
    if (entry.status === 'verified') return res.status(400).json({ success: false, error: 'Already checked in' });

    const apptDate = new Date(entry.appointment.date);
    const today = new Date();
    const isSameDay = apptDate.getFullYear() === today.getFullYear() && apptDate.getMonth() === today.getMonth() && apptDate.getDate() === today.getDate();
    const isPastDay = apptDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!isSameDay && !isPastDay) {
      return res.status(400).json({ success: false, error: `Your appointment is on ${apptDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — check-in opens on the day of your appointment.`, tooEarly: true });
    }

    const radius = Number(CHECKIN_RADIUS_METERS) || 200;
    const dist = distanceMeters(Number(HOSPITAL_LAT), Number(HOSPITAL_LNG), Number(lat), Number(lng));
    if (dist > radius) {
      return res.status(400).json({ success: false, error: `You're ${Math.round(dist)}m from the hospital — get within ${radius}m to auto check-in.`, distance: Math.round(dist) });
    }

    entry.status = 'verified';
    entry.verifiedAt = new Date();
    await entry.save();

    const io = req.app.get('io');
    if (io) io.emit('patient_checked_in', { entryId: entry._id, patientName: entry.patient.name, appointmentId, viaGeofence: true });

    res.json({ success: true, data: entry, message: 'Checked in automatically — welcome!' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

const entryConfirmedHTML = (patient, doctor, appt, otp) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:30px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">🎫</div>
  <h1 style="color:#fff;font-size:21px;font-weight:800;margin:0">Your Hospital Entry Code</h1>
  <p style="color:rgba(255,255,255,.8);font-size:13px;margin:8px 0 0">Show this at the reception desk on arrival</p>
</td></tr>
<tr><td style="padding:32px">
  <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 18px">Dear ${patient.name}, your payment is confirmed for your appointment with Dr. ${doctor.name} on ${new Date(appt.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})} at ${appt.timeSlot}.</p>
  <div style="background:#ecfeff;border:2px dashed #67e8f9;border-radius:16px;padding:24px;text-align:center;margin-bottom:20px">
    <div style="color:#0e7490;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Entry Verification Code</div>
    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#0e7490;font-family:monospace">${otp}</div>
  </div>
  <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px">
    <h3 style="color:#92400e;font-size:13px;margin:0 0 8px">📋 What to do on arrival</h3>
    <ol style="color:#92400e;font-size:13px;margin:0;padding-left:18px;line-height:1.9">
      <li>Go to the <strong>reception desk</strong> first — entry check-in is mandatory for all patients</li>
      <li>Give the receptionist this <strong>6-digit code</strong></li>
      <li>Once verified, you'll be assigned a room and a ward staff member will guide you there</li>
    </ol>
  </div>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;

const checkinConfirmedHTML = (patient, room, wardboy) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#059669,#34d399);padding:30px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">✅</div>
  <h1 style="color:#fff;font-size:21px;font-weight:800;margin:0">Entry Confirmed!</h1>
</td></tr>
<tr><td style="padding:32px">
  <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 18px">Hi ${patient.name}, you've been successfully checked in.${room ? ` A staff member will escort you to your assigned room shortly.` : ''}</p>
  ${room ? `
  <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:16px;padding:20px;text-align:center">
    <div style="color:#15803d;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Room</div>
    <div style="font-size:26px;font-weight:900;color:#15803d">${room.name || room.type || 'Room'} · ${room.number || 'TBD'}</div>
    <div style="color:#15803d;font-size:13px;margin-top:4px">Floor ${room.floor ?? 'TBD'} · ${room.type || ''}</div>
  </div>` : ''}
  ${wardboy ? `
  <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:16px;padding:16px 20px;text-align:center;margin-top:14px">
    <div style="color:#1d4ed8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Ward Assistant</div>
    <div style="font-size:18px;font-weight:800;color:#1d4ed8">${wardboy.name}</div>
    ${wardboy.phone ? `<div style="color:#1d4ed8;font-size:13px;margin-top:2px">${wardboy.phone}</div>` : ''}
    <div style="color:#3b82f6;font-size:12.5px;margin-top:4px">Will escort you to your room shortly</div>
  </div>` : ''}
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;

// ── Called internally (from paymentController) when an appointment payment
//    is confirmed — generates the entry OTP and emails it to the patient.
exports.generateEntryOTP = async (appointment) => {
  // Video consultations never involve walking into the hospital, so
  // there's nothing to check in for — generating and texting/emailing an
  // entry code here would just be confusing noise for a video patient.
  if (appointment.consultMode === 'video') return null;

  const otp = genOTP();
  const apptDateMs = new Date(appointment.date).getTime();
  const dayAfterAppt = apptDateMs + 24 * 60 * 60 * 1000;
  const entry = await EntryVerification.create({
    appointment: appointment._id,
    patient:     appointment.patient._id || appointment.patient,
    doctor:      appointment.doctor._id || appointment.doctor,
    otp,
    otpExpiresAt: dayAfterAppt > Date.now() ? new Date(dayAfterAppt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  if (appointment.patient?.email) {
    emailService.sendGeneral({
      to: appointment.patient.email,
      subject: `🎫 Your Hospital Entry Code: ${otp} | Mediventra`,
      html: entryConfirmedHTML(appointment.patient, appointment.doctor, appointment, otp),
    }).catch(console.error);
  }
  if (appointment.patient?.phone) {
    smsService.sendOtpSMS({ to: appointment.patient.phone, otp, purpose: 'hospital entry', expiresIn: '24 hours' }).catch(console.error);
  }
  return entry;
};

// GET /api/entry/mine — patient sees their own pending entry codes
exports.getMyEntries = async (req, res) => {
  try {
    const entries = await EntryVerification.find({ patient: req.user.id, status: { $ne: 'cancelled' } })
      .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialization department' } })
      .populate('room', 'name number floor type')
      .populate('assignedWardboy', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: entries.length, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/entry/pending — receptionist's queue of patients awaiting check-in
exports.getPendingEntries = async (req, res) => {
  try {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const entries = (await EntryVerification.find({ status: 'awaiting_arrival', otpExpiresAt: { $gte: new Date() } })
      .populate('patient', 'name phone email bloodGroup')
      .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialization department' } })
      .sort({ createdAt: 1 }))
      // Only show patients whose appointment is today or already past —
      // someone who booked for tomorrow (or later) shouldn't show up in
      // today's check-in queue and can't be checked in early.
      .filter(e => e.appointment && new Date(e.appointment.date) <= endOfToday);
    res.json({ success: true, count: entries.length, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/entry/verify — receptionist enters the OTP the patient gives them.
// Check-in on its own no longer forces a room/bed assignment — most patients
// are outpatients who just proceed to the doctor's queue. If the receptionist
// judges the patient may need a bed (bedLikely: true), that's recorded as a
// flag for the doctor to confirm after examining them — see flagBedLikely
// below and appointmentController.decideAdmission.
exports.verifyEntry = async (req, res) => {
  try {
    const { appointmentId, otp, bedLikely, flagNote } = req.body;
    if (!appointmentId || !otp) return res.status(400).json({ success: false, error: 'appointmentId and otp are required' });

    const entry = await EntryVerification.findOne({ appointment: appointmentId })
      .populate('patient', 'name email phone bloodGroup')
      .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialization department' } });

    if (!entry) return res.status(404).json({ success: false, error: 'No entry record found for this appointment' });
    if (entry.status === 'verified') return res.status(400).json({ success: false, error: 'This patient has already been checked in' });

    // Check-in only opens on the day of the appointment itself — a patient
    // who booked for tomorrow shouldn't be checked in today, even though
    // their entry code already exists (it's emailed right after payment,
    // well ahead of the visit).
    const apptDate = new Date(entry.appointment.date);
    const today = new Date();
    const isSameDay = apptDate.getFullYear() === today.getFullYear() && apptDate.getMonth() === today.getMonth() && apptDate.getDate() === today.getDate();
    const isPastDay = apptDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!isSameDay && !isPastDay) {
      return res.status(400).json({
        success: false,
        error: `This patient's appointment is on ${apptDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — check-in only opens on the day of the appointment.`,
        tooEarly: true,
      });
    }

    if (entry.otpExpiresAt < new Date()) {
      entry.status = 'expired';
      await entry.save();
      return res.status(400).json({ success: false, error: 'This entry code has expired' });
    }
    if (entry.otp !== String(otp).trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect entry code — please check with the patient and try again' });
    }

    entry.status = 'verified';
    entry.verifiedBy = req.user.id;
    entry.verifiedAt = new Date();
    entry.bedLikely = !!bedLikely;
    await entry.save();

    if (bedLikely) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        admission: {
          status: 'flagged', flaggedBy: req.user.id, flaggedAt: new Date(),
          flagNote: (flagNote || '').trim(),
        },
      });
      const doctorId = entry.appointment?.doctor?._id;
      if (doctorId) {
        await notify(req, doctorId, {
          type: 'admission_flagged', title: '🛏️ Possible admission flagged at check-in',
          message: `${entry.patient.name} may need a bed — please confirm after examination`,
          link: '/dashboard', icon: '🛏️',
        });
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('patient_checked_in', { entryId: entry._id, patientName: entry.patient.name, appointmentId, bedLikely: !!bedLikely });

    res.json({
      success: true, data: entry,
      message: bedLikely
        ? `${entry.patient.name} checked in — flagged for possible admission, awaiting doctor confirmation.`
        : `${entry.patient.name} checked in successfully — they can now proceed to the doctor's queue.`,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/entry/:id — remove a check-in record from the pending queue
// (e.g. entered by mistake, duplicate, patient left). This only removes the
// check-in tracking record, never the underlying appointment itself.
exports.deleteEntry = async (req, res) => {
  try {
    const entry = await EntryVerification.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: 'Entry record not found' });
    if (entry.status === 'verified' && entry.room) {
      return res.status(400).json({ success: false, error: 'This patient already has a room assigned — cannot delete this entry.' });
    }
    await entry.deleteOne();
    const io = req.app.get('io');
    if (io) io.emit('entry_deleted', { entryId: req.params.id });
    res.json({ success: true, message: 'Entry removed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/entry/:id/assign-room — receptionist/admin assigns a room after verification
exports.assignRoom = async (req, res) => {
  try {
    const { roomId, notes, wardboyId } = req.body;
    const entry = await EntryVerification.findById(req.params.id)
      .populate('patient', 'name email phone bloodGroup')
      .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialization department' } });
    if (!entry) return res.status(404).json({ success: false, error: 'Entry record not found' });
    if (entry.status !== 'verified') return res.status(400).json({ success: false, error: 'Patient must be checked in before assigning a room' });

    const room = await OTRoom.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.status === 'occupied' && room.occupiedBeds >= room.capacity) {
      return res.status(400).json({ success: false, error: 'This room is at full capacity' });
    }

    let wardboy = null;
    if (wardboyId) {
      wardboy = await User.findOne({ _id: wardboyId, role: 'wardboy' }).select('name phone');
      if (!wardboy) return res.status(404).json({ success: false, error: 'Selected wardboy not found' });
    }

    entry.room = room._id;
    entry.roomAssignedBy = req.user.id;
    entry.roomAssignedAt = new Date();
    entry.notes = notes || '';
    entry.wardboyNotified = true;
    entry.assignedWardboy = wardboy?._id || null;
    await entry.save();

    await OTRoom.findByIdAndUpdate(room._id, {
      assignedPatient: entry.patient._id,
      assignedWardboy: wardboy?._id || null,
      occupiedBeds: Math.min(room.capacity, room.occupiedBeds + 1),
      status: 'occupied',
    });

    if (entry.patient?.email) {
      emailService.sendGeneral({
        to: entry.patient.email,
        subject: `✅ Checked In — Room ${room.number || room.name || ''} Assigned | Mediventra`,
        html: checkinConfirmedHTML(entry.patient, room, wardboy),
      }).catch(console.error);
    }

    await notify(req, entry.patient._id, {
      type: 'room_assigned',
      title: `🏥 Room ${room.number || room.name} assigned`,
      message: `${room.type || 'Room'} · Floor ${room.floor ?? ''}${wardboy ? ` — ${wardboy.name} will escort you` : ''}`,
      link: '/dashboard', icon: '🏥',
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        entryId:   entry._id,
        patient:   { name: entry.patient.name, phone: entry.patient.phone, bloodGroup: entry.patient.bloodGroup },
        doctor:    entry.appointment.doctor.name,
        room:      { name: room.name, number: room.number, floor: room.floor, type: room.type },
        notes:     entry.notes,
        wardboy:   wardboy ? { id: wardboy._id, name: wardboy.name } : null,
      };
      io.to(`user_${entry.patient._id}`).emit('patient_room_assigned', payload);
      if (wardboy) {
        // Specifically assigned — notify just that wardboy directly
        io.to(`user_${wardboy._id}`).emit('patient_room_assigned', payload);
      } else {
        // No specific wardboy chosen — broadcast so any available wardboy can pick it up
        io.emit('patient_room_assigned', payload);
      }
    }

    res.json({ success: true, data: entry });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/entry/wardboy-queue — every recently room-assigned patient a
// wardboy needs to go escort, with full details (room, doctor, contact)
exports.getWardboyQueue = async (req, res) => {
  try {
    const entries = await EntryVerification.find({ status: 'verified', room: { $ne: null } })
      .populate('patient', 'name phone bloodGroup')
      .populate('room', 'name number floor type')
      .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialization department' } })
      .sort({ roomAssignedAt: -1 })
      .limit(30);
    res.json({ success: true, count: entries.length, data: entries });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/entry/:id/acknowledge — wardboy marks "I've got this, on my way / done"
exports.acknowledgeEntry = async (req, res) => {
  try {
    const entry = await EntryVerification.findByIdAndUpdate(
      req.params.id,
      { wardboyAcknowledgedBy: req.user.id, wardboyAcknowledgedAt: new Date() },
      { new: true }
    ).populate('patient', 'name').populate('room', 'name number');
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });

    const io = req.app.get('io');
    if (io) io.emit('patient_escort_acknowledged', { entryId: entry._id, patient: entry.patient.name, room: entry.room?.number });

    res.json({ success: true, data: entry });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
