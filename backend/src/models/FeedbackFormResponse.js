const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type:       { type: String, enum: ['rating', 'text', 'suggestion'], required: true },
  label:      { type: String, required: true }, // snapshot of the question text at time of answering
  value:      { type: mongoose.Schema.Types.Mixed, required: true }, // Number for rating, String for text/suggestion
}, { _id: false });

const FeedbackFormResponseSchema = new mongoose.Schema({
  form:           { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackForm', required: true },
  respondent:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  respondentRole: { type: String, required: true },
  answers:        [AnswerSchema],
}, { timestamps: true });

FeedbackFormResponseSchema.index({ form: 1, respondent: 1 }, { unique: true }); // one response per person per form

module.exports = mongoose.model('FeedbackFormResponse', FeedbackFormResponseSchema);
