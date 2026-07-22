const Invoice = require('../models/Invoice');
const BillingPackage = require('../models/BillingPackage');
const InsuranceClaim = require('../models/InsuranceClaim');
const PreAuthRequest = require('../models/PreAuthRequest');
const { notify } = require('../utils/notify');

const POP = [
  { path: 'patient', select: 'name phone email' },
  { path: 'package', select: 'name category' },
  { path: 'insuranceClaim', select: 'status approvedAmount policy' },
  { path: 'preAuth', select: 'status approvedAmount preAuthNumber' },
];

// Computes GST breakdown for one line item, mutating it in place, and
// returns the computed line so callers can sum totals.
function computeLine(item, interState) {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
  const discount = Math.max(0, Number(item.discount) || 0);
  const rate = Number(item.gstRate) || 0;

  const gross = qty * unitPrice;
  const taxable = Math.max(0, gross - discount);
  const gstAmount = taxable * (rate / 100);
  const cgst = interState ? 0 : gstAmount / 2;
  const sgst = interState ? 0 : gstAmount / 2;
  const igst = interState ? gstAmount : 0;
  const lineTotal = taxable + gstAmount;

  return {
    description: item.description, hsnSac: item.hsnSac || '', quantity: qty, unitPrice, discount, gstRate: rate,
    taxableAmount: Math.round(taxable * 100) / 100,
    cgst: Math.round(cgst * 100) / 100, sgst: Math.round(sgst * 100) / 100, igst: Math.round(igst * 100) / 100,
    lineTotal: Math.round(lineTotal * 100) / 100,
  };
}

function buildTotals(lineItems) {
  const subtotal = lineItems.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalDiscount = lineItems.reduce((s, l) => s + (l.discount || 0), 0);
  const totalTaxable = lineItems.reduce((s, l) => s + l.taxableAmount, 0);
  const totalCGST = lineItems.reduce((s, l) => s + l.cgst, 0);
  const totalSGST = lineItems.reduce((s, l) => s + l.sgst, 0);
  const totalIGST = lineItems.reduce((s, l) => s + l.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxable + totalGST;
  const round2 = n => Math.round(n * 100) / 100;
  return {
    subtotal: round2(subtotal), totalDiscount: round2(totalDiscount), totalTaxable: round2(totalTaxable),
    totalCGST: round2(totalCGST), totalSGST: round2(totalSGST), totalIGST: round2(totalIGST),
    totalGST: round2(totalGST), grandTotal: round2(grandTotal),
  };
}

// POST /api/invoices
exports.createInvoice = async (req, res) => {
  try {
    const { patient, appointment, admission, packageId, lineItems, interState, placeOfSupply, insuranceClaimId, preAuthId, notes } = req.body;
    if (!patient) return res.status(400).json({ success: false, error: 'Patient is required' });

    let items = [];
    if (packageId) {
      const pkg = await BillingPackage.findById(packageId);
      if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
      items = [{ description: pkg.name, quantity: 1, unitPrice: pkg.price, discount: 0, gstRate: pkg.gstRate }];
    } else if (Array.isArray(lineItems) && lineItems.length > 0) {
      items = lineItems;
    } else {
      return res.status(400).json({ success: false, error: 'Provide at least one line item, or select a package' });
    }

    const missingDesc = items.find(i => !i.description?.trim() || i.unitPrice === undefined || i.unitPrice === null);
    if (missingDesc) return res.status(400).json({ success: false, error: 'Every line item needs a description and a unit price' });

    const computedItems = items.map(i => computeLine(i, !!interState));
    const totals = buildTotals(computedItems);

    let insuranceCoveredAmount = 0;
    if (insuranceClaimId) {
      const claim = await InsuranceClaim.findById(insuranceClaimId);
      if (claim && ['approved', 'paid'].includes(claim.status)) {
        insuranceCoveredAmount = Math.min(claim.approvedAmount || 0, totals.grandTotal);
      }
    } else if (preAuthId) {
      const preAuth = await PreAuthRequest.findById(preAuthId);
      if (preAuth && ['approved', 'partially_approved'].includes(preAuth.status)) {
        insuranceCoveredAmount = Math.min(preAuth.approvedAmount || 0, totals.grandTotal);
      }
    }

    const invoice = await Invoice.create({
      patient, appointment: appointment || null, admission: admission || null, package: packageId || null,
      lineItems: computedItems, interState: !!interState, placeOfSupply: placeOfSupply || '',
      ...totals,
      insuranceClaim: insuranceClaimId || null, preAuth: preAuthId || null, insuranceCoveredAmount,
      notes: notes?.trim() || '', createdBy: req.user.id,
    });
    await invoice.populate(POP);

    await notify(req, patient, {
      type: 'invoice_created', title: '🧾 New invoice',
      message: `Invoice ${invoice.invoiceNumber} — ₹${totals.grandTotal.toLocaleString('en-IN')}`,
      link: '/billing', icon: '🧾',
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/invoices?patientId=&status=&paymentStatus=
exports.getAll = async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'patient') q.patient = req.user.id;
    else if (req.query.patientId) q.patient = req.query.patientId;
    if (req.query.status) q.status = req.query.status;
    if (req.query.paymentStatus) q.paymentStatus = req.query.paymentStatus;
    const invoices = await Invoice.find(q).populate(POP).sort({ createdAt: -1 });
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/invoices/:id
exports.getOne = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate(POP);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (req.user.role === 'patient' && String(invoice.patient._id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    res.json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/invoices/:id/pay — record a payment (full or partial)
exports.recordPayment = async (req, res) => {
  try {
    const { amount, paymentMode } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, error: 'Enter a valid payment amount' });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status === 'cancelled') return res.status(400).json({ success: false, error: 'Cannot record payment on a cancelled invoice' });

    const dueBeforeInsurance = invoice.grandTotal - invoice.insuranceCoveredAmount;
    invoice.amountPaid = Math.min(dueBeforeInsurance, invoice.amountPaid + Number(amount));
    invoice.paymentMode = paymentMode || invoice.paymentMode;
    invoice.paymentStatus = invoice.amountPaid >= dueBeforeInsurance ? 'paid' : invoice.amountPaid > 0 ? 'partial' : 'unpaid';
    if (invoice.paymentStatus === 'paid') invoice.paidAt = new Date();
    await invoice.save();
    await invoice.populate(POP);

    res.json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/invoices/:id/cancel
exports.cancelInvoice = async (req, res) => {
  try {
    const { reason } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.amountPaid > 0) return res.status(400).json({ success: false, error: 'Cannot cancel an invoice that already has payments recorded — issue a credit note process instead' });
    invoice.status = 'cancelled';
    invoice.cancelReason = reason?.trim() || '';
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/invoices/gst-summary?from=&to= — GST filing helper: totals by rate
exports.gstSummary = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30*24*60*60*1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const invoices = await Invoice.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } });

    const byRate = {};
    let grand = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    for (const inv of invoices) {
      for (const li of inv.lineItems) {
        const r = li.gstRate;
        if (!byRate[r]) byRate[r] = { rate: r, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        byRate[r].taxable += li.taxableAmount; byRate[r].cgst += li.cgst; byRate[r].sgst += li.sgst; byRate[r].igst += li.igst;
        byRate[r].total += li.lineTotal;
        grand.taxable += li.taxableAmount; grand.cgst += li.cgst; grand.sgst += li.sgst; grand.igst += li.igst; grand.total += li.lineTotal;
      }
    }
    res.json({ success: true, data: { from, to, invoiceCount: invoices.length, byRate: Object.values(byRate), grand } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Billing packages CRUD ──────────────────────────────────────────────
exports.createPackage = async (req, res) => {
  try {
    const { name, category, description, includedItems, price, gstRate } = req.body;
    if (!name?.trim() || price === undefined) return res.status(400).json({ success: false, error: 'Name and price are required' });
    const pkg = await BillingPackage.create({ name: name.trim(), category: category?.trim()||'', description: description?.trim()||'', includedItems: includedItems||[], price: Number(price), gstRate: Number(gstRate)||0, createdBy: req.user.id });
    res.status(201).json({ success: true, data: pkg });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getPackages = async (req, res) => {
  try {
    const q = req.query.all ? {} : { active: true };
    const packages = await BillingPackage.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: packages });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.updatePackage = async (req, res) => {
  try {
    const pkg = await BillingPackage.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    res.json({ success: true, data: pkg });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.deletePackage = async (req, res) => {
  try {
    const pkg = await BillingPackage.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    res.json({ success: true, message: 'Package deactivated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
