const mongoose = require('mongoose');

// Simple record of every bug a user reports from the floating 🐞 button —
// gives the team an in-app audit trail in addition to the email alert,
// so reports aren't lost even if an email bounces or gets missed.
const BugReportSchema = new mongoose.Schema({
  reportedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedByName: { type: String, default: '' },
  reportedByRole: { type: String, default: '' },
  reportedByEmail:{ type: String, default: '' },
  description:    { type: String, required: true },
  page:           { type: String, default: '' }, // which screen/URL they were on
  screenshotUrl:  { type: String, default: '' }, // optional attached image
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open',
  },
  emailSent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BugReport', BugReportSchema);
