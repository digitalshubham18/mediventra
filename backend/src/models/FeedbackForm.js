const mongoose = require('mongoose');

// A single question within a feedback form. Kept intentionally simple —
// three question types cover everything the admin asked for: a star
// rating, a short suggestion box, and a general open-ended remark/text
// question.
const QuestionSchema = new mongoose.Schema({
  type:     { type: String, enum: ['rating', 'text', 'suggestion'], required: true },
  label:    { type: String, required: true }, // the question text shown to the user
  required: { type: Boolean, default: true },
}, { _id: true });

const FeedbackFormSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  questions: [QuestionSchema],

  // Which dashboards/roles this form is shown on. Admin picks any
  // combination — e.g. just 'nurse' and 'wardboy', or every role.
  targetRoles: { type: [String], default: [] },

  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('FeedbackForm', FeedbackFormSchema);
