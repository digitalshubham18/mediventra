const Salary = require('../models/Salary');
const User   = require('../models/User');
const Attendance = require('../models/Attendance');
const Schedule    = require('../models/Schedule');
const Leave       = require('../models/Leave');
const emailService = require('../utils/emailService');
const { notify } = require('../utils/notify');

const BASE_PAY = { admin:80000, doctor:120000, nurse:45000, pharmacist:50000, wardboy:25000, sweeper:20000, otboy:28000, finance:65000, electrician:30000, plumber:28000, it_technician:40000, equipment_tech:35000, biomedical:55000, security:22000, receptionist:28000, ambulance_driver:25000, lab_technician:42000 };

// Works out how many days an employee actually worked (vs. was absent) in a
// given month from real Attendance records — rather than assuming a flat
// 26 days worked, which is what happened before regardless of whether the
// person actually showed up. Falls back to a standard Mon–Sat working
// week (Sundays off) when no shift roster (Schedule) exists for the
// employee that month, since not every role has explicit shift rosters.
async function computeAttendanceStats(employeeId, month, year) {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);
  const today = new Date();
  const effectiveEnd = monthEnd < today ? monthEnd : today; // don't count future days in the current/ongoing month

  const [attendance, schedules, leaves] = await Promise.all([
    Attendance.find({ user: employeeId, date: { $gte: monthStart, $lte: monthEnd } }),
    Schedule.find({ user: employeeId, date: { $gte: monthStart, $lte: monthEnd } }),
    Leave.find({ user: employeeId, status: 'approved', from: { $lte: monthEnd }, to: { $gte: monthStart } }),
  ]);

  const attByDay = new Map(attendance.map(a => [new Date(a.date).toDateString(), a]));
  const isOnLeave = (d) => leaves.some(l => new Date(l.from) <= d && new Date(l.to) >= d);

  let dayKeys;
  if (schedules.length > 0) {
    dayKeys = [...new Set(schedules.map(s => new Date(s.date).toDateString()))];
  } else {
    dayKeys = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) dayKeys.push(new Date(d).toDateString()); // Sundays off by default
    }
  }

  let daysWorked = 0, daysAbsent = 0, daysOnLeave = 0, lateDays = 0, workingDaysCounted = 0;
  for (const dayKey of dayKeys) {
    const d = new Date(dayKey);
    if (d > effectiveEnd) continue;
    workingDaysCounted++;
    const att = attByDay.get(dayKey);
    if (att?.status === 'present') daysWorked += 1;
    else if (att?.status === 'late') { daysWorked += 1; if (!att.lateWaived) lateDays += 1; }
    else if (att?.status === 'half_day') daysWorked += 0.5;
    else if (att?.status === 'on_leave' || isOnLeave(d)) daysOnLeave += 1;
    else daysAbsent += 1;
  }
  return { daysWorked, daysAbsent, daysOnLeave, lateDays, workingDaysCounted };
}

const LATE_FINE_PER_DAY = 50; // ₹ per unwaived late day

function calcSalary(basic, daysWorked=26, daysAbsent=0, overtimeHours=0, bonus=0, loan=0, otherDed=0, lateDays=0) {
  const hra   = Math.round(basic * 0.40);
  const da    = Math.round(basic * 0.12);
  const ta    = Math.round(basic * 0.05);
  const med   = Math.round(basic * 0.03);
  const spl   = Math.round(basic * 0.05);
  const otPay = Math.round((basic / 26 / 8) * 1.5 * overtimeHours);
  const gross = basic + hra + da + ta + med + spl + otPay + bonus;
  const pf    = Math.round(basic * 0.12);
  const esi   = Math.round(gross * 0.0175);
  const tax   = Math.round(gross * 0.10);
  const absent= daysAbsent > 0 ? Math.round((basic / 26) * daysAbsent) : 0;
  const lateFine = Math.max(0, lateDays) * LATE_FINE_PER_DAY;
  const totalDed = pf + esi + tax + absent + lateFine + loan + otherDed;
  const net   = gross - totalDed;
  return { hra, da, ta, medical:med, special:spl, otPay, gross, pf, esi, tax, absent, lateFine, totalDed, net };
}
exports.calcSalary = calcSalary; // exported for unit tests

exports.getSalaries = async (req, res) => {
  try {
    const q = {};
    if (req.user.role !== 'admin' && req.user.role !== 'finance') q.employee = req.user.id;
    if (req.query.employeeId) q.employee = req.query.employeeId;
    if (req.query.month)  q.month  = parseInt(req.query.month);
    if (req.query.year)   q.year   = parseInt(req.query.year);
    if (req.query.status) q.status = req.query.status;
    const salaries = await Salary.find(q)
      .populate('employee','name role department email phone bankDetails')
      .populate('creditedBy','name')
      .sort({ year:-1, month:-1 });
    res.json({ success:true, count:salaries.length, data:salaries });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.getMySummary = async (req, res) => {
  try {
    const salaries = await Salary.find({ employee:req.user.id }).sort({ year:-1, month:-1 }).limit(12);
    res.json({ success:true, data:{ latest:salaries[0]||null, history:salaries } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// GET /api/salary/attendance-preview?employeeId=&month=&year= — lets
// finance see what daysWorked/daysAbsent WILL be used before generating,
// so it's not a black box.
exports.attendancePreview = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId || !month || !year) return res.status(400).json({ success:false, error:'employeeId, month, and year are required' });
    const stats = await computeAttendanceStats(employeeId, Number(month), Number(year));
    res.json({ success:true, data:stats });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.generateSalary = async (req, res) => {
  try {
    const { employeeId, month, year, daysWorked: manualWorked, daysAbsent: manualAbsent, overtimeHours=0, bonus=0, loan=0, otherDed=0, paymentMode='bank_transfer', bankAccount='', remarks='' } = req.body;
    const emp = await User.findById(employeeId);
    if (!emp) return res.status(404).json({ success:false, error:'Employee not found' });

    // Auto-compute from real attendance unless finance explicitly overrides
    // both figures — this is what makes salary reflect only working days
    // actually worked, instead of a flat assumed 26 days regardless of
    // attendance.
    let daysWorked = manualWorked, daysAbsent = manualAbsent, lateDays = 0, attendanceNote = '';
    if (daysWorked === undefined || daysAbsent === undefined) {
      const stats = await computeAttendanceStats(employeeId, month, year);
      if (daysWorked === undefined) daysWorked = stats.daysWorked;
      if (daysAbsent === undefined) daysAbsent = stats.daysAbsent;
      lateDays = stats.lateDays;
      attendanceNote = `Auto-computed from attendance: ${stats.daysWorked} worked, ${stats.daysAbsent} absent, ${stats.lateDays} late (unwaived), ${stats.daysOnLeave} on approved leave (of ${stats.workingDaysCounted} working days).`;
    } else if (req.body.lateDays !== undefined) {
      lateDays = Number(req.body.lateDays);
    }

    const basic = BASE_PAY[emp.role] || 30000;
    const c     = calcSalary(basic, daysWorked, daysAbsent, overtimeHours, bonus, loan, otherDed, lateDays);
    const salary = await Salary.findOneAndUpdate(
      { employee:employeeId, month, year },
      {
        employee:employeeId, month, year, basicPay:basic,
        daysWorked, daysAbsent, lateDays, overtimeHours, overtimePay:c.otPay,
        allowances:{ hra:c.hra, da:c.da, ta:c.ta, medical:c.medical, special:c.special },
        deductions:{ pf:c.pf, esi:c.esi, tax:c.tax, absent:c.absent, lateFine:c.lateFine, loan, other:otherDed },
        grossPay:c.gross, netPay:c.net, remarks, paymentMode, bankAccount, status:'pending',
      },
      { upsert:true, new:true }
    );
    await salary.populate('employee','name role department');
    res.status(201).json({ success:true, data:salary, attendanceNote });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// Runs async work over a list with limited concurrency, so a hospital with
// hundreds of staff doesn't fire hundreds of simultaneous DB writes at once,
// while still being far faster than one-at-a-time sequential awaits.
async function processInBatches(items, batchSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(worker)));
  }
  return results;
}

exports.bulkGenerate = async (req, res) => {
  try {
    const { month, year } = req.body;
    const staff = await User.find({ status:'approved', role:{ $ne:'patient' } });

    const results = await processInBatches(staff, 20, async (emp) => {
      const basic = BASE_PAY[emp.role] || 30000;
      const stats = await computeAttendanceStats(emp._id, month, year);
      const c = calcSalary(basic, stats.daysWorked, stats.daysAbsent, 0, 0, 0, 0, stats.lateDays);
      return Salary.findOneAndUpdate(
        { employee:emp._id, month, year },
        { employee:emp._id, month, year, basicPay:basic, daysWorked:stats.daysWorked, daysAbsent:stats.daysAbsent, lateDays:stats.lateDays, overtimeHours:0, overtimePay:0,
          allowances:{ hra:c.hra, da:c.da, ta:c.ta, medical:c.medical, special:c.special },
          deductions:{ pf:c.pf, esi:c.esi, tax:c.tax, absent:c.absent, lateFine:c.lateFine, loan:0, other:0 },
          grossPay:c.gross, netPay:c.net, status:'pending' },
        { upsert:true, new:true }
      );
    });

    res.json({ success:true, count:results.length });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// Basic real-world format checks — NOT a guarantee the account is real,
// but catches the obvious "blank", "garbage", or "fat-fingered" cases that
// previously let salary get marked credited against a non-existent or
// malformed account.
const IFSC_RX = /^[A-Z]{4}0[A-Z0-9]{6}$/;          // standard Indian IFSC format
const ACCOUNT_RX = /^[0-9]{9,18}$/;                 // most Indian bank accounts are 9-18 digits

function validateBankDetails(bd) {
  if (!bd) return { ok: false, reason: 'No bank details on file.' };
  const accountNumber = (bd.accountNumber || '').trim();
  const ifsc = (bd.ifsc || '').trim().toUpperCase();
  const accountHolder = (bd.accountHolder || '').trim();
  if (!accountNumber || !ifsc || !accountHolder) {
    return { ok: false, reason: 'Bank details are incomplete (account number, IFSC, or account holder name missing).' };
  }
  if (!ACCOUNT_RX.test(accountNumber)) {
    return { ok: false, reason: 'Bank account number format looks invalid.' };
  }
  if (!IFSC_RX.test(ifsc)) {
    return { ok: false, reason: 'IFSC code format looks invalid.' };
  }
  return { ok: true };
}

function maskAccount(num) {
  if (!num || num.length < 4) return '****';
  return `${'*'.repeat(num.length - 4)}${num.slice(-4)}`;
}

function genTransactionRef() {
  return 'TXN' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

exports.creditSalary = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id).populate('employee', 'name role email bankDetails notificationPrefs');
    if (!salary) return res.status(404).json({ success:false, error:'Salary record not found' });

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = MONTHS[(salary.month||1)-1];

    // ── Manual payment override (cash/cheque) ───────────────────────────
    // For when a bank account can't be fixed in time — finance can hand
    // over the salary directly instead of waiting on the employee. This
    // intentionally bypasses the bank-account check entirely, since no
    // bank transfer is happening.
    const { paymentMode, manualReference, manualNotes, receiptNumber, chequeNumber, chequeBankName, chequeBranch, chequeDate, payeeName } = req.body || {};
    if (paymentMode === 'cash' || paymentMode === 'cheque') {
      // Cash needs a receipt number on file; cheque needs the cheque
      // number, issuing bank, and date — without these there's no paper
      // trail to reconcile the payment against later.
      if (paymentMode === 'cash') {
        const receiptNo = (receiptNumber || manualReference || '').trim();
        if (!receiptNo) return res.status(400).json({ success: false, error: 'Receipt number is required for a cash payment' });
      }
      if (paymentMode === 'cheque') {
        const chqNo = (chequeNumber || manualReference || '').trim();
        if (!chqNo) return res.status(400).json({ success: false, error: 'Cheque number is required for a cheque payment' });
        if (!chequeBankName?.trim()) return res.status(400).json({ success: false, error: 'Bank name is required for a cheque payment' });
        if (!chequeDate) return res.status(400).json({ success: false, error: 'Cheque date is required for a cheque payment' });
      }

      salary.status = 'credited';
      salary.creditedAt = new Date();
      salary.creditedBy = req.user.id;
      salary.failureReason = '';
      salary.paymentMode = paymentMode;
      salary.transactionRef = (paymentMode === 'cash' ? (receiptNumber || manualReference) : (chequeNumber || manualReference))?.trim() || genTransactionRef();
      salary.remarks = manualNotes?.trim() || `Paid manually via ${paymentMode} by ${req.user.name || 'finance'}`;
      salary.manualPaymentDetails = paymentMode === 'cash'
        ? { receiptNumber: (receiptNumber || manualReference || '').trim(), payeeName: (payeeName || '').trim() }
        : {
            chequeNumber: (chequeNumber || manualReference || '').trim(),
            chequeBankName: (chequeBankName || '').trim(),
            chequeBranch: (chequeBranch || '').trim(),
            chequeDate: chequeDate ? new Date(chequeDate) : null,
            payeeName: (payeeName || '').trim(),
          };
      await salary.save();

      const io = req.app.get('io');
      if (io) io.to(`user_${salary.employee._id}`).emit('salary_credited', { month:salary.month, year:salary.year, netPay:salary.netPay, grossPay:salary.grossPay, transactionRef: salary.transactionRef, paymentMode });
      await notify(req, salary.employee._id, { type:'salary_credited', title:'💰 Salary paid', message:`Your salary of ₹${salary.netPay?.toLocaleString('en-IN')} for ${monthName} ${salary.year} was paid via ${paymentMode}`, link:'/salary', icon:'💰' });

      if (salary.employee?.email && emailService.shouldEmail(salary.employee, 'salary')) {
        emailService.sendGeneral({
          to: salary.employee.email,
          subject: `💰 Salary Paid (${paymentMode === 'cash' ? 'Cash' : 'Cheque'}) — ${monthName} ${salary.year} | Mediventra`,
          html: `<p style="font-family:sans-serif">Hi ${salary.employee.name}, your salary of ₹${salary.netPay?.toLocaleString('en-IN')} for ${monthName} ${salary.year} has been paid via <strong>${paymentMode}</strong>. Reference: ${salary.transactionRef}.</p>`,
        }).catch(console.error);
      }

      return res.json({ success: true, data: salary, message: `Marked as paid via ${paymentMode}` });
    }

    // ── Validate the employee's bank account before moving real money ──
    const check = validateBankDetails(salary.employee?.bankDetails);
    if (!check.ok) {
      salary.status = 'failed';
      salary.failureReason = check.reason;
      await salary.save();

      const io = req.app.get('io');
      if (io && salary.employee?._id) {
        io.to(`user_${salary.employee._id}`).emit('salary_failed', { month: salary.month, year: salary.year, reason: check.reason });
      }
      if (salary.employee?._id) await notify(req, salary.employee._id, { type:'salary_failed', title:'⚠️ Salary credit failed', message:`Your salary for ${monthName} ${salary.year} couldn't be credited: ${check.reason}`, link:'/salary', icon:'⚠️' });

      if (salary.employee?.email) {
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:32px;text-align:center">
  <div style="font-size:48px;margin-bottom:8px">⏳</div>
  <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Your Salary Is Waiting!</h1>
  <p style="color:rgba(255,255,255,.85);font-size:14px;margin:8px 0 0">${monthName} ${salary.year} — Mediventra</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:19px;font-weight:700;margin:0 0 14px">Hello, ${salary.employee.name}!</h2>
  <p style="color:#64748b;font-size:14.5px;line-height:1.7;margin:0 0 18px">
    We tried to credit your salary of <strong>₹${salary.netPay?.toLocaleString('en-IN')}</strong> for <strong>${monthName} ${salary.year}</strong>, but we couldn't find a valid bank account on file.
  </p>
  <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;padding:16px 18px;margin-bottom:20px">
    <p style="margin:0;color:#92400e;font-size:13.5px;font-weight:600">Reason: ${check.reason}</p>
  </div>
  <p style="color:#64748b;font-size:14.5px;line-height:1.7;margin:0 0 22px">
    Please update your bank details as soon as possible so we can release your payment. No money has been moved — your salary remains safely on hold until your account information is correct.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings?tab=profile" style="display:inline-block;background:linear-gradient(135deg,#1648c9,#0c2c7a);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px">Update My Bank Details →</a>
  </td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;
        emailService.sendGeneral({ to: salary.employee.email, subject: `⏳ Action Needed — Your ${monthName} Salary Is Waiting | Mediventra`, html }).catch(console.error);
      }

      return res.status(400).json({ success: false, error: `Could not credit salary: ${check.reason} An email has been sent asking the employee to update their bank details.`, data: salary });
    }

    // ── Bank details look valid — move the (real, already-computed) money ──
    const bd = salary.employee.bankDetails;
    salary.status = 'credited';
    salary.creditedAt = new Date();
    salary.creditedBy = req.user.id;
    salary.failureReason = '';
    salary.transactionRef = genTransactionRef();
    salary.bankAccount = bd.accountNumber; // keep legacy field in sync
    salary.bankSnapshot = {
      accountHolder: bd.accountHolder,
      accountNumberMasked: maskAccount(bd.accountNumber),
      ifsc: bd.ifsc.toUpperCase(),
      bankName: bd.bankName || '',
    };
    await salary.save();

    // Real-time socket notification
    const io = req.app.get('io');
    if (io) io.to(`user_${salary.employee._id}`).emit('salary_credited', { month:salary.month, year:salary.year, netPay:salary.netPay, grossPay:salary.grossPay, transactionRef: salary.transactionRef });
    await notify(req, salary.employee._id, { type:'salary_credited', title:'💰 Salary credited', message:`Your salary of ₹${salary.netPay?.toLocaleString('en-IN')} for ${monthName} ${salary.year} has been credited to your bank account`, link:'/salary', icon:'💰' });

    // Send salary credited email
    if (salary.employee?.email) {
      const allowTotal = Object.values(salary.allowances||{}).reduce((a,b)=>a+b,0);
      const dedTotal   = Object.values(salary.deductions||{}).reduce((a,b)=>a+b,0);
      const salaryHTML = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#059669,#34d399);padding:32px;text-align:center">
  <div style="font-size:48px;margin-bottom:8px">💰</div>
  <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0">Salary Credited!</h1>
  <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">${monthName} ${salary.year} — Mediventra</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 16px">Hello, ${salary.employee.name}!</h2>
  <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px">Your salary for <strong>${monthName} ${salary.year}</strong> has been successfully credited.</p>
  <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #bbf7d0;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
    <p style="color:#15803d;font-size:14px;margin:0 0 8px;font-weight:600">Net Take Home</p>
    <p style="color:#059669;font-size:42px;font-weight:900;margin:0;font-family:monospace">₹${salary.netPay?.toLocaleString('en-IN')}</p>
    <p style="color:#64748b;font-size:13px;margin:8px 0 0">Payment Mode: ${(salary.paymentMode||'bank_transfer').replace('_',' ')}</p>
    <p style="color:#64748b;font-size:12px;margin:4px 0 0">A/C: ${salary.bankSnapshot?.accountNumberMasked || '****'} · Txn Ref: ${salary.transactionRef}</p>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
    <tr style="background:#f8fafc"><td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e8edf3">Basic Pay</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #e8edf3">₹${salary.basicPay?.toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e8edf3">Total Allowances</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#15803d;text-align:right;border-bottom:1px solid #e8edf3">+₹${allowTotal.toLocaleString('en-IN')}</td></tr>
    <tr style="background:#fef2f2"><td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e8edf3">Total Deductions</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;border-bottom:1px solid #e8edf3">-₹${dedTotal.toLocaleString('en-IN')}</td></tr>
    <tr style="background:#f0fdf4"><td style="padding:12px 14px;font-size:14px;font-weight:800;color:#0f172a">Net Pay</td><td style="padding:12px 14px;font-size:16px;font-weight:900;color:#059669;text-align:right">₹${salary.netPay?.toLocaleString('en-IN')}</td></tr>
  </table>
  <p style="color:#94a3b8;font-size:12px;text-align:center">For queries, contact your Finance Officer at Mediventra</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:18px;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0">Mediventra · Secure Healthcare Platform</p>
</td></tr>
</table></td></tr></table></body></html>`;

      if (emailService.shouldEmail(salary.employee, 'salary')) {
        emailService.sendGeneral({ to: salary.employee.email, subject: `💰 Salary Credited — ${monthName} ${salary.year} | Mediventra`, html: salaryHTML }).catch(console.error);
      }
    }

    res.json({ success:true, data:salary });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.updateSalary = async (req, res) => {
  try {
    const salary = await Salary.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('employee','name role');
    if (!salary) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:salary });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// POST /api/salary/extra-payment — finance pays an employee an ad-hoc extra
// amount (bonus, arrears, reimbursement, festival advance, etc.) at any
// time, independent of the regular monthly salary cycle and regardless of
// whether that month's base salary has already been generated/credited.
// If no salary record exists yet for the current month, a placeholder one
// is created to host the payment so there's a single ledger per employee
// per month.
exports.addExtraPayment = async (req, res) => {
  try {
    const { employeeId, amount, reason } = req.body;
    if (!employeeId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success:false, error:'Employee and a valid amount are required' });
    }
    const emp = await User.findById(employeeId);
    if (!emp) return res.status(404).json({ success:false, error:'Employee not found' });

    const now = new Date();
    const month = now.getMonth() + 1, year = now.getFullYear();
    let salary = await Salary.findOne({ employee: employeeId, month, year });
    if (!salary) {
      salary = await Salary.create({ employee: employeeId, month, year, basicPay: 0, daysWorked: 0, daysAbsent: 0, grossPay: 0, netPay: 0, status: 'pending' });
    }

    salary.extraPayments.push({ amount: Number(amount), reason: reason?.trim() || 'Extra payment', addedBy: req.user.id, addedAt: now });
    salary.grossPay += Number(amount);
    salary.netPay += Number(amount);
    await salary.save();
    await salary.populate('employee', 'name role department');

    await notify(req, employeeId, {
      type: 'salary_extra_payment', title: '💰 Extra payment added',
      message: `₹${Number(amount).toLocaleString('en-IN')} — ${reason?.trim() || 'Extra payment'}`,
      link: '/salary', icon: '💰',
    });
    const io = req.app.get('io');
    if (io) io.to(`user_${employeeId}`).emit('salary_extra_payment', { amount: Number(amount), reason: reason?.trim() || '' });

    res.status(201).json({ success:true, data: salary });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
};
