const mongoose = require('mongoose');

// Standard Indian GST slabs used for healthcare-adjacent billable items
// (most core medical services are GST-exempt, but room rent above a
// threshold, non-medical consumables, and cosmetic/elective procedures
// typically are not — so rate is chosen per line item, not hospital-wide).
const GST_RATES = [0, 5, 12, 18, 28];

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsnSac:      { type: String, default: '' }, // HSN/SAC code, for GST-compliant invoices
  quantity:    { type: Number, default: 1, min: 1 },
  unitPrice:   { type: Number, required: true, min: 0 },
  discount:    { type: Number, default: 0, min: 0 }, // flat amount off this line's subtotal
  gstRate:     { type: Number, enum: GST_RATES, default: 0 },
  // Computed & stored at save time so historical invoices don't change if rates/logic change later
  taxableAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, sparse: true },
  patient:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  admission:     { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', default: null },
  package:       { type: mongoose.Schema.Types.ObjectId, ref: 'BillingPackage', default: null },

  lineItems: { type: [LineItemSchema], default: [] },

  // Whether this is an intra-state (CGST+SGST) or inter-state (IGST)
  // supply, decided by comparing hospital state to patient's billing state.
  placeOfSupply: { type: String, default: '' },
  interState:    { type: Boolean, default: false },

  subtotal:       { type: Number, default: 0 }, // sum of (qty*unitPrice) before discount
  totalDiscount:  { type: Number, default: 0 },
  totalTaxable:   { type: Number, default: 0 },
  totalCGST:      { type: Number, default: 0 },
  totalSGST:      { type: Number, default: 0 },
  totalIGST:      { type: Number, default: 0 },
  totalGST:       { type: Number, default: 0 },
  grandTotal:     { type: Number, default: 0 },

  // Insurance / TPA linkage — an invoice can be partly or fully covered,
  // either via a post-treatment reimbursement claim OR a pre-approved
  // cashless authorization (mutually exclusive in practice, both supported).
  insuranceClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceClaim', default: null },
  preAuth:        { type: mongoose.Schema.Types.ObjectId, ref: 'PreAuthRequest', default: null },
  insuranceCoveredAmount: { type: Number, default: 0 },

  amountPaid:   { type: Number, default: 0 },
  paymentMode:  { type: String, enum: ['cash','card','upi','netbanking','insurance','pending',''], default: '' },
  paymentStatus:{ type: String, enum: ['unpaid','partial','paid'], default: 'unpaid' },
  paidAt:       { type: Date, default: null },

  status: { type: String, enum: ['draft','issued','cancelled'], default: 'issued' },
  cancelReason: { type: String, default: '' },
  notes:   { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

InvoiceSchema.index({ patient: 1, createdAt: -1 });

InvoiceSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const now = new Date();
    // Indian FY runs Apr–Mar — a nod to how real GST invoice numbering is usually done
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
    this.invoiceNumber = `INV/${fy}/${Date.now().toString().slice(-8)}`;
  }
  next();
});

InvoiceSchema.statics.GST_RATES = GST_RATES;

module.exports = mongoose.model('Invoice', InvoiceSchema);
