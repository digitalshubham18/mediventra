
const Payment     = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Order       = require('../models/Order');
const crypto      = require('crypto');
const emailService = require('../utils/emailService');
const { generateEntryOTP } = require('./entryController');

const apptConfirmHTML = (patient, doctor, appt, payment) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:30px;text-align:center">
  <div style="font-size:40px;margin-bottom:8px">📅</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Appointment Confirmed!</h1>
  <p style="color:rgba(255,255,255,.75);font-size:14px;margin:8px 0 0">Mediventra Hospital Management System</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:19px;margin:0 0 10px">Dear ${patient.name},</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px">Your appointment has been confirmed and payment received. Please find the details below:</p>
  <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:16px;padding:22px;margin-bottom:24px">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[['👨‍⚕️ Doctor','Dr. '+doctor.name+(doctor.specialization?' ('+doctor.specialization+')':'')],['📅 Date',new Date(appt.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],['⏰ Time',appt.timeSlot],['🏥 Type',(appt.type||'Consultation')],['📋 Reason',appt.reason||'General Consultation'],['💰 Fee','₹'+appt.fee]].map(([l,v])=>`
      <tr><td style="padding:8px 0;border-bottom:1px solid #e0f2fe;color:#64748b;font-size:14px;width:140px">${l}</td><td style="padding:8px 0;border-bottom:1px solid #e0f2fe;color:#0f172a;font-weight:700;font-size:14px">${v}</td></tr>`).join('')}
    </table>
  </div>
  <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:18px;margin-bottom:20px">
    <h3 style="color:#92400e;font-size:14px;margin:0 0 10px">⚠️ Important Instructions</h3>
    <ul style="color:#92400e;font-size:13px;margin:0;padding-left:18px;line-height:1.8">
      <li>Please arrive <strong>15 minutes before</strong> your appointment time</li>
      <li>Bring your <strong>government ID</strong> and any previous medical records</li>
      <li>If fasting is required, avoid food/drink for <strong>8 hours</strong> before the appointment</li>
      <li>Wear <strong>comfortable clothing</strong> for easy examination</li>
      <li>Bring a list of <strong>current medications</strong> you are taking</li>
      <li>To cancel or reschedule, do so at least <strong>24 hours in advance</strong></li>
    </ul>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center">
    <p style="color:#15803d;font-size:14px;font-weight:700;margin:0 0 4px">✅ Payment of ₹${appt.fee} received successfully</p>
    <p style="color:#15803d;font-size:12px;margin:0">Receipt No: ${payment.receiptNo} · Transaction ID: ${payment.transactionId}</p>
  </div>
  <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">For any queries, contact our reception desk or call our helpline.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform · 🔒 Confidential</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

// Generate receipt number
const genReceipt = () => 'RCP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();

// POST /api/payments/create-order — creates real Razorpay order when keys
// are configured; falls back to a simulated order ID in demo/test mode.
exports.createOrder = async (req, res) => {
  try {
    const { amount, type='appointment', appointmentId, orderId: linkedOrderId, description='' } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success:false, error:'Invalid amount' });

    let razorpayOrderId;
    const amountPaise = Math.round(amount * 100); // Razorpay works in paise

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
        !process.env.RAZORPAY_KEY_ID.includes('REPLACE')) {
      // ── REAL Razorpay order ─────────────────────────────────────────
      const Razorpay = require('razorpay');
      const rzp = new Razorpay({
        key_id:     process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const rzpOrder = await rzp.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  genReceipt(),
        notes:    { type, description, patientId: req.user.id },
      });
      razorpayOrderId = rzpOrder.id;
    } else {
      // ── Simulated order (demo mode) ──────────────────────────────────
      razorpayOrderId = 'order_' + crypto.randomBytes(10).toString('hex');
    }

    const payment = await Payment.create({
      user:        req.user.id,
      appointment: appointmentId  || null,
      order:       linkedOrderId  || null,
      type, amount, status: 'pending',
      razorpayOrderId,
      description,
    });

    res.json({
      success: true,
      data: {
        orderId:   razorpayOrderId,
        amount,
        currency:  'INR',
        paymentId: payment._id,
        key:       process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      }
    });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// POST /api/payments/verify — HMAC-SHA256 signature verification for real
// Razorpay payments; also auto-confirms the linked appointment + sends email.
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId, method='razorpay', cardBrand='', cardLast4='' } = req.body;

    // Verify signature when running with real Razorpay keys
    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature &&
        !process.env.RAZORPAY_KEY_SECRET.includes('REPLACE')) {
      const body      = razorpayOrderId + '|' + razorpayPaymentId;
      const expected  = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
      if (expected !== razorpaySignature) {
        return res.status(400).json({ success:false, error:'Payment signature verification failed — possible tampering' });
      }
    }

    const receipt = genReceipt();
    const payment = await Payment.findByIdAndUpdate(paymentId, {
      razorpayPaymentId, razorpaySignature,
      transactionId: razorpayPaymentId,
      status: 'success', method, cardBrand, cardLast4,
      receiptNo: receipt, paidAt: new Date(),
    }, { new:true })
      .populate('user','name email phone')
      .populate({ path:'appointment', populate:[{path:'doctor',select:'name specialization'},{path:'patient',select:'name email phone'}] });

    if (!payment) return res.status(404).json({ success:false, error:'Payment record not found' });

    // ── Re-check slot availability before confirming ────────────────
    if (payment.appointment) {
      const appt = payment.appointment;
      const conflict = await Appointment.findOne({
        _id:      { $ne: appt._id },
        doctor:   appt.doctor,
        date:     appt.date,
        timeSlot: appt.timeSlot,
        status:   { $in: ['pending','confirmed'] },
      });
      if (conflict) {
        await Payment.findByIdAndUpdate(paymentId, { status:'failed', notes:'Slot conflict at payment time' });
        await Appointment.findByIdAndUpdate(appt._id, { status:'cancelled', cancelReason:'Slot taken at payment time' });
        return res.status(409).json({ success:false, error:'This slot was just booked by another patient. You have not been charged — please choose a different slot.' });
      }

      await Appointment.findByIdAndUpdate(appt._id, { paid:true, paymentStatus:'paid', status:'confirmed' });

      // Generate the hospital-entry OTP — sent to patient now, verified by
      // reception when the patient physically arrives on the day.
      generateEntryOTP(appt).catch(console.error);

      // Send confirmation email
      if (appt.patient?.email) {
        emailService.sendGeneral({
          to: appt.patient.email,
          subject: `✅ Appointment Confirmed — Dr. ${appt.doctor?.name||'Doctor'} | Mediventra`,
          html: apptConfirmHTML(appt.patient, appt.doctor, appt, payment),
        }).catch(console.error);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${appt.doctor._id}`).emit('new_appointment', { patientName: appt.patient?.name, date: appt.date, timeSlot: appt.timeSlot });
        io.emit('appointment_updated', { appointmentId: appt._id, status:'confirmed', patient: appt.patient?.name });
      }
    }

    res.json({ success:true, data:payment });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// Simulate payment success (for demo without real Razorpay)
exports.simulatePayment = async (req, res) => {
  try {
    const { paymentId, method='upi' } = req.body;
    const receipt = genReceipt();
    const payment = await Payment.findByIdAndUpdate(paymentId, {
      razorpayPaymentId: 'sim_' + Date.now(),
      transactionId: 'TXN' + Date.now(),
      status: 'success', method,
      receiptNo: receipt, paidAt: new Date(),
    }, { new:true })
      .populate('user','name email phone')
      .populate({ path:'appointment', populate:[{path:'doctor',select:'name specialization'},{path:'patient',select:'name email phone'}] });
    if (!payment) return res.status(404).json({ success:false, error:'Payment not found' });

    if (payment.appointment) {
      const appt = payment.appointment;
      // Same slot-conflict guard as confirm()/verifyPayment() — without
      // this, simulated payments could confirm a double-booked slot.
      const conflict = await Appointment.findOne({
        _id:      { $ne: appt._id },
        doctor:   appt.doctor,
        date:     appt.date,
        timeSlot: appt.timeSlot,
        status:   { $in: ['pending','confirmed'] },
      });
      if (conflict) {
        await Payment.findByIdAndUpdate(paymentId, { status:'failed', notes:'Slot conflict at payment time' });
        await Appointment.findByIdAndUpdate(appt._id, { status:'cancelled', cancelReason:'Slot taken at payment time' });
        return res.status(409).json({ success:false, error:'This slot was just booked by another patient. You have not been charged — please choose a different slot.' });
      }

      await Appointment.findByIdAndUpdate(appt._id, { paid:true, paymentStatus:'paid', status:'confirmed' });

      generateEntryOTP(appt).catch(console.error);

      if (appt.patient?.email) {
        emailService.sendGeneral({
          to: appt.patient.email,
          subject: `✅ Appointment Confirmed — Dr. ${appt.doctor?.name||'Doctor'} | Mediventra`,
          html: apptConfirmHTML(appt.patient, appt.doctor, appt, payment),
        }).catch(console.error);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${appt.doctor._id}`).emit('new_appointment', { patientName: appt.patient?.name, date: appt.date, timeSlot: appt.timeSlot });
        io.emit('appointment_updated', { appointmentId: appt._id, status:'confirmed', patient: appt.patient?.name });
      }
    }

    res.json({ success:true, data:payment });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.getPayments = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.user = req.user.id;
    if (req.query.userId)  q.user   = req.query.userId;
    if (req.query.status)  q.status = req.query.status;
    if (req.query.type)    q.type   = req.query.type;
    const payments = await Payment.find(q)
      .populate('user','name email phone')
      .populate({ path:'appointment', populate:[{path:'doctor',select:'name specialization'}] })
      .populate('order')
      .sort({ createdAt:-1 });
    res.json({ success:true, count:payments.length, data:payments });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user','name email phone')
      .populate({ path:'appointment', populate:[{path:'doctor',select:'name specialization'},{path:'patient',select:'name email'}] })
      .populate('order');
    if (!payment) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:payment });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// ── POST /api/payments/initiate ─────────────────────────────────────────
// Creates a pending Payment record linked to an appointment (or other type)
exports.initiate = async (req, res) => {
  try {
    const { type = 'appointment', refId } = req.body;
    let amount = 0;
    let appointmentId = null;
    let description = '';

    let orderId = null;

    if (type === 'appointment') {
      const appt = await Appointment.findById(refId).populate('doctor', 'name specialization');
      if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found' });
      if (appt.patient.toString() !== req.user.id && !['admin','receptionist'].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      amount = appt.fee || 500;
      appointmentId = appt._id;
      description = `Consultation with Dr. ${appt.doctor?.name || 'Doctor'}`;
    } else if (type === 'order') {
      const order = await Order.findById(refId);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
      if (order.patient.toString() !== req.user.id && !['admin','pharmacist'].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      amount = order.totalAmount || 0;
      orderId = order._id;
      description = `Medicine Order #${order.orderNumber || order._id.toString().slice(-6).toUpperCase()}`;
    } else {
      amount = req.body.amount || 0;
      description = req.body.description || 'Hospital service payment';
    }

    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount — please contact support' });

    const payment = await Payment.create({
      user: req.user.id,
      appointment: appointmentId,
      order: orderId,
      type,
      amount,
      status: 'pending',
      description,
      razorpayOrderId: 'order_' + crypto.randomBytes(10).toString('hex'),
    });

    res.json({ success: true, data: { paymentId: payment._id, amount, currency: 'INR' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── POST /api/payments/confirm ──────────────────────────────────────────
// Simulated gateway confirmation — validates input by method, marks payment
// success, confirms linked appointment, and sends confirmation email.
exports.confirm = async (req, res) => {
  try {
    const { paymentId, method, card, upi, upiApp, bank, wallet } = req.body;
    const payment = await Payment.findById(paymentId).populate('user', 'name email phone');
    if (!payment) return res.status(404).json({ success: false, error: 'Payment record not found' });
    if (payment.status === 'success') return res.status(400).json({ success: false, error: 'Payment already completed' });

    let cardBrand = '', cardLast4 = '';

    // ── Validate by method (simulated gateway rules) ──
    if (method === 'card') {
      const num = (card?.number || '').replace(/\s/g, '');
      if (num.length !== 16) return res.status(400).json({ success: false, error: 'Invalid card number' });
      if (!card?.name || card.name.length < 3) return res.status(400).json({ success: false, error: 'Invalid cardholder name' });
      if (!/^\d{2}\/\d{2}$/.test(card?.expiry || '')) return res.status(400).json({ success: false, error: 'Invalid expiry date' });
      if (!card?.cvv || card.cvv.length < 3) return res.status(400).json({ success: false, error: 'Invalid CVV' });
      // Simulated decline for specific test card
      if (num === '4000000000000002') return res.status(402).json({ success: false, error: 'Card declined by issuing bank. Please try another card.' });
      cardLast4 = num.slice(-4);
      if (/^4/.test(num)) cardBrand = 'Visa';
      else if (/^5[1-5]/.test(num)) cardBrand = 'Mastercard';
      else if (/^3[47]/.test(num)) cardBrand = 'Amex';
      else cardBrand = 'Card';
    } else if (method === 'upi') {
      if (!upiApp) return res.status(400).json({ success: false, error: 'Please select a UPI app' });
      if (!/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test((upi || '').trim())) {
        return res.status(400).json({ success: false, error: 'Invalid UPI ID' });
      }
    } else if (method === 'netbanking') {
      if (!bank) return res.status(400).json({ success: false, error: 'Please select a bank' });
    } else if (method === 'wallet') {
      if (!wallet) return res.status(400).json({ success: false, error: 'Please select a wallet' });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid payment method' });
    }

    // Hoisted so the final response can include the confirmed appointment
    // (appointmentNumber + doctor) for the frontend's post-booking
    // "Where to Meet" seating-area confirmation.
    let confirmedAppt = null;

    // ── If linked to an appointment, re-verify the slot is still free,
    //    then confirm it + send email. This guards against a race where
    //    two patients pay for the same doctor/date/timeSlot at nearly the
    //    same time — only the first payment to land here gets confirmed;
    //    the second is refused and the patient is told to rebook.
    if (payment.appointment) {
      const pendingAppt = await Appointment.findById(payment.appointment);
      if (!pendingAppt) {
        return res.status(404).json({ success: false, error: 'Appointment record not found' });
      }

      const conflict = await Appointment.findOne({
        _id:      { $ne: pendingAppt._id },
        doctor:   pendingAppt.doctor,
        date:     pendingAppt.date,
        timeSlot: pendingAppt.timeSlot,
        status:   { $in: ['pending', 'confirmed'] },
      });

      if (conflict) {
        // Slot got taken by someone else while this payment was in flight —
        // mark this payment refunded-equivalent (failed) rather than success,
        // so the hospital ledger doesn't show money taken for a slot that
        // was never actually delivered, and let the patient know to pick
        // a different time.
        payment.status = 'failed';
        payment.notes   = 'Auto-failed: time slot was booked by another patient before payment completed.';
        await payment.save();
        await Appointment.findByIdAndUpdate(pendingAppt._id, { status: 'cancelled', cancelReason: 'Slot no longer available at payment time' });
        return res.status(409).json({ success: false, error: 'Sorry, this time slot was just booked by another patient. Please choose a different slot — you have not been charged.' });
      }

      // ── Mark payment as successful (money received into hospital account) ──
      const receipt = genReceipt();
      payment.status          = 'success';
      payment.method          = method;
      payment.transactionId   = 'TXN' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();
      payment.razorpayPaymentId = payment.transactionId;
      payment.cardBrand        = cardBrand;
      payment.cardLast4        = cardLast4;
      payment.receiptNo         = receipt;
      payment.paidAt            = new Date();
      payment.notes             = method === 'upi' ? `UPI: ${upi} via ${upiApp||'UPI App'}` : method === 'netbanking' ? `Bank: ${bank}` : method === 'wallet' ? `Wallet: ${wallet}` : '';
      await payment.save();

      const appt = await Appointment.findByIdAndUpdate(payment.appointment, { paid: true, paymentStatus: 'paid', status: 'confirmed' }, { new: true })
        .populate('patient', 'name email phone')
        .populate('doctor', 'name specialization');
      confirmedAppt = appt;

      generateEntryOTP(appt).catch(console.error);

      if (appt?.patient?.email) {
        emailService.sendGeneral({
          to: appt.patient.email,
          subject: `✅ Appointment Confirmed — Dr. ${appt.doctor?.name || 'Doctor'} | Mediventra`,
          html: apptConfirmHTML(appt.patient, appt.doctor, appt, payment),
        }).catch(console.error);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${appt.doctor._id}`).emit('new_appointment', {
          patientName: appt.patient.name, date: appt.date, timeSlot: appt.timeSlot,
        });
        io.emit('appointment_updated', { appointmentId: appt._id, status: 'confirmed', patient: appt.patient.name });
      }
    } else {
      // ── Non-appointment payment (e.g. order) — mark successful as normal ──
      const receipt = genReceipt();
      payment.status          = 'success';
      payment.method          = method;
      payment.transactionId   = 'TXN' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();
      payment.razorpayPaymentId = payment.transactionId;
      payment.cardBrand        = cardBrand;
      payment.cardLast4        = cardLast4;
      payment.receiptNo         = receipt;
      payment.paidAt            = new Date();
      payment.notes             = method === 'upi' ? `UPI: ${upi} via ${upiApp||'UPI App'}` : method === 'netbanking' ? `Bank: ${bank}` : method === 'wallet' ? `Wallet: ${wallet}` : '';
      await payment.save();
    }

    // ── If linked to an order, mark it paid + notify ──
    if (payment.order) {
      const order = await Order.findByIdAndUpdate(payment.order, { paymentMethod: 'online', paymentStatus: 'paid' }, { new: true })
        .populate('patient', 'name email');

      if (order?.patient?.email) {
        const itemsHTML = (order.items || []).map(i => `
          <tr><td style="padding:8px 0;border-bottom:1px solid #e0f2fe;color:#374151;font-size:13px">${i.medicineName} × ${i.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e0f2fe;color:#0f172a;font-weight:700;font-size:13px;text-align:right">₹${i.subtotal}</td></tr>`).join('');
        const orderHTML = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#059669,#34d399);padding:28px;text-align:center">
  <div style="font-size:40px;margin-bottom:6px">💊</div>
  <h1 style="color:#fff;font-size:21px;font-weight:800;margin:0">Order Confirmed!</h1>
  <p style="color:rgba(255,255,255,.8);font-size:13px;margin:6px 0 0">Order #${order.orderNumber || order._id.toString().slice(-6).toUpperCase()}</p>
</td></tr>
<tr><td style="padding:30px">
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${order.patient.name}, your medicine order has been confirmed and payment received.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px">${itemsHTML}
    <tr><td style="padding:10px 0 0;font-weight:800;color:#0f172a">Total Paid</td><td style="padding:10px 0 0;font-weight:900;color:#059669;text-align:right">₹${payment.amount}</td></tr>
  </table>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;font-size:12px;color:#15803d">✅ Receipt: ${payment.receiptNo} · Your order will be processed and dispatched shortly.</div>
</td></tr>
</table></td></tr></table></body></html>`;
        emailService.sendGeneral({ to: order.patient.email, subject: `✅ Order Confirmed — #${order.orderNumber || ''} | Mediventra`, html: orderHTML }).catch(console.error);
      }
    }

    res.json({ success: true, data: payment, appointment: confirmedAppt });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/payments/manual-invoice — admin/finance: bill a patient directly
// for something not tied to an existing appointment/pharmacy/lab order
// (e.g. a walk-in procedure or misc charge), recorded as already paid.
exports.createManualInvoice = async (req, res) => {
  try {
    const { patientId, amount, method, description, notes } = req.body;
    if (!patientId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Patient and a valid amount are required' });
    }
    if (!description?.trim()) return res.status(400).json({ success: false, error: 'A description is required for the invoice' });

    const User = require('../models/User');
    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const payment = await Payment.create({
      user: patientId,
      type: 'other',
      amount: Number(amount),
      status: 'success',
      method: method || 'cash',
      receiptNo: genReceipt(),
      description: description.trim(),
      notes: notes?.trim() || `Manual invoice raised by ${req.user.name || 'finance'}`,
      paidAt: new Date(),
    });

    res.status(201).json({ success: true, data: payment, message: `Invoice created — receipt ${payment.receiptNo}` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
