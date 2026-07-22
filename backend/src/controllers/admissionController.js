const Admission = require('../models/Admission');
const OTRoom = require('../models/OTRoom');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Task = require('../models/Task');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const { notify } = require('../utils/notify');

const genReceipt = () => 'RCP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();

// POST /api/admissions — admit a patient to a room/bed
exports.admitPatient = async (req, res) => {
  try {
    const { patientId, roomId, admittingDoctorId, reasonForAdmission, expectedDischargeDate, roomChargePerDay, appointmentId, wardboyId } = req.body;
    if (!patientId || !roomId || !admittingDoctorId || !reasonForAdmission?.trim() || !roomChargePerDay) {
      return res.status(400).json({ success: false, error: 'Patient, room, admitting doctor, reason, and room charge are required' });
    }

    const room = await OTRoom.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.occupiedBeds >= room.capacity) return res.status(400).json({ success: false, error: 'This room has no free beds' });

    const admission = await Admission.create({
      patient: patientId, room: roomId, admittingDoctor: admittingDoctorId,
      reasonForAdmission: reasonForAdmission.trim(), expectedDischargeDate: expectedDischargeDate || null,
      roomChargePerDay: Number(roomChargePerDay), createdBy: req.user.id,
    });

    room.occupiedBeds += 1;
    if (room.occupiedBeds >= room.capacity) room.status = 'occupied';
    await room.save();

    // If this admission came from a receptionist actioning a doctor-confirmed
    // bed request, close the loop on that appointment so it drops out of the
    // pending queue and shows the assigned room.
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        'admission.status': 'assigned',
        'admission.admissionRecord': admission._id,
      });
    }

    // Optionally hand the escort off to a specific wardboy (or notify all if
    // none picked), same as the check-in room-assignment flow does.
    if (wardboyId) {
      const wardboy = await User.findOne({ _id: wardboyId, role: 'wardboy' }).select('name phone');
      if (wardboy) {
        const task = await Task.create({
          title: `Escort admitted patient to Room ${room.number}`,
          description: `${room.name || ''} (${room.type}), Floor ${room.floor}. Reason: ${reasonForAdmission.trim()}`,
          assignedTo: wardboy._id, assignedBy: req.user.id, priority: 'high', category: 'transport', room: room._id,
        });
        await notify(req, wardboy._id, { type:'task_assigned', title:'🛏️ New patient to escort', message:`Room ${room.number} — ${reasonForAdmission.trim()}`, link:'/tasks', icon:'🛏️' });
        const ioW = req.app.get('io');
        if (ioW) ioW.to(`user_${wardboy._id}`).emit('task_assigned', { taskId: task._id, title: task.title, assignedBy: req.user.name, priority: task.priority });
      }
    }

    await admission.populate('patient', 'name phone');
    await admission.populate('room', 'name number type floor');

    await notify(req, patientId, {
      type: 'admitted', title: '🏥 You have been admitted',
      message: `Room ${admission.room.number} (${admission.room.type}), Floor ${admission.room.floor}`,
      link: '/dashboard', icon: '🏥',
    });

    const io = req.app.get('io');
    if (io) io.emit('admission_created', { admissionId: admission._id, roomId, patientName: admission.patient.name });

    res.status(201).json({ success: true, data: admission });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/admissions?status=admitted
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.patientId) q.patient = req.query.patientId;
    const admissions = await Admission.find(q)
      .populate('patient', 'name phone age bloodGroup')
      .populate('room', 'name number type floor')
      .populate('admittingDoctor', 'name specialization')
      .sort({ admissionDate: -1 });
    res.json({ success: true, data: admissions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/admissions/mine — patient's own admission history
exports.getMine = async (req, res) => {
  try {
    const admissions = await Admission.find({ patient: req.user.id })
      .populate('room', 'name number type floor')
      .populate('admittingDoctor', 'name specialization')
      .sort({ admissionDate: -1 });
    res.json({ success: true, data: admissions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/admissions/:id/bill-preview — compute what the bill would be right now (before discharge is finalized)
exports.getBillPreview = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id).populate('patient', 'name');
    if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' });

    const days = Math.max(1, Math.ceil((Date.now() - new Date(admission.admissionDate)) / (1000*60*60*24)));
    const roomCharges = days * admission.roomChargePerDay;

    const orders = await Order.find({
      patient: admission.patient._id, createdAt: { $gte: admission.admissionDate }, status: { $ne: 'cancelled' },
    });
    const pharmacyCharges = orders.reduce((t, o) => t + (o.totalAmount || 0), 0);

    res.json({ success: true, data: { days, roomCharges, pharmacyCharges, pharmacyOrderCount: orders.length } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/admissions/:id/discharge — discharge the patient and generate a consolidated final bill
exports.dischargePatient = async (req, res) => {
  try {
    const { dischargeSummary, doctorFee, otherCharges, otherChargesNote, paymentMode } = req.body;
    const admission = await Admission.findById(req.params.id).populate('patient', 'name email').populate('room');
    if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' });
    if (admission.status === 'discharged') return res.status(400).json({ success: false, error: 'This patient has already been discharged' });

    const dischargeDate = new Date();
    const days = Math.max(1, Math.ceil((dischargeDate - new Date(admission.admissionDate)) / (1000*60*60*24)));
    const roomCharges = days * admission.roomChargePerDay;

    const orders = await Order.find({
      patient: admission.patient._id, createdAt: { $gte: admission.admissionDate, $lte: dischargeDate }, status: { $ne: 'cancelled' },
    });
    const pharmacyCharges = orders.reduce((t, o) => t + (o.totalAmount || 0), 0);

    const docFee = Number(doctorFee) || 0;
    const other = Number(otherCharges) || 0;
    const totalAmount = roomCharges + pharmacyCharges + docFee + other;

    const payment = await Payment.create({
      user: admission.patient._id, type: 'admission', amount: totalAmount, status: 'success',
      method: paymentMode || 'cash', receiptNo: genReceipt(),
      description: `Admission bill — Room ${admission.room.number} (${days} day${days!==1?'s':''})`,
      notes: `Room: ₹${roomCharges} · Pharmacy: ₹${pharmacyCharges} · Doctor fee: ₹${docFee}${other?` · Other: ₹${other} (${otherChargesNote||''})`:''}`,
      paidAt: dischargeDate,
    });

    admission.status = 'discharged';
    admission.dischargeDate = dischargeDate;
    admission.dischargeSummary = dischargeSummary?.trim() || '';
    admission.bill = {
      roomCharges, pharmacyCharges, doctorFee: docFee, otherCharges: other,
      otherChargesNote: otherChargesNote?.trim() || '', totalAmount,
      paymentMode: paymentMode || 'cash', payment: payment._id,
    };
    await admission.save();

    const room = admission.room;
    room.occupiedBeds = Math.max(0, room.occupiedBeds - 1);
    room.status = room.occupiedBeds > 0 ? 'occupied' : 'available';
    await room.save();

    // Auto-create an escort task for a wardboy — discharge used to just be
    // a status flip with no actual handoff to the floor staff who need to
    // walk the patient out and free up the equipment.
    const wardboy = await User.findOne({ role: 'wardboy', status: 'approved' }).sort({ createdAt: 1 });
    if (wardboy) {
      const task = await Task.create({
        title: `Escort discharged patient: ${admission.patient.name}`,
        description: `Room ${room.number} (${room.type}), Floor ${room.floor}. Assist with belongings and escort to the exit; collect any loaned equipment.`,
        assignedTo: wardboy._id, assignedBy: req.user.id, priority: 'medium', category: 'transport', room: room._id,
      });
      await notify(req, wardboy._id, { type:'task_assigned', title:'🛏️ Discharge escort needed', message:`${admission.patient.name} — Room ${room.number}`, link:'/tasks', icon:'🛏️' });
      const io2 = req.app.get('io');
      if (io2) io2.to(`user_${wardboy._id}`).emit('task_assigned', { taskId: task._id, title: task.title, assignedBy: req.user.name, priority: task.priority });
    }

    await notify(req, admission.patient._id, {
      type: 'discharged', title: '✅ You have been discharged',
      message: `Final bill: ₹${totalAmount.toLocaleString('en-IN')} — receipt ${payment.receiptNo}`,
      link: '/dashboard', icon: '✅',
    });

    const io = req.app.get('io');
    if (io) io.emit('admission_discharged', { admissionId: admission._id, roomId: room._id });

    res.json({ success: true, data: admission });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
