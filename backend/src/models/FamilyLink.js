const mongoose = require('mongoose');

// Lets one patient account manage a family member's health data —
// children or elderly relatives who don't need (or can't manage) their
// own login. The dependent is a REAL User document (role: 'patient') so
// all existing features (records, appointments, orders) work for them
// unmodified; this model just tracks who's allowed to view/act on
// whose behalf, and the family member's own login stays fully separate
// if they have one.
const FamilyLinkSchema = new mongoose.Schema({
  primaryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the managing account
  dependent:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the managed profile
  relation:    { type: String, required: true }, // e.g. 'Child', 'Parent', 'Spouse', 'Grandparent'
  canManage:   { type: Boolean, default: true }, // false = view-only access
}, { timestamps: true });

FamilyLinkSchema.index({ primaryUser: 1 });
FamilyLinkSchema.index({ primaryUser: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('FamilyLink', FamilyLinkSchema);
