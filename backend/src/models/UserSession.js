const mongoose = require('mongoose');

// One document per login. Closed (logoutAt set) on explicit logout, on the
// next login from the same device, or by the cleanup job in cronJob.js for
// sessions left open by a closed browser tab (no logout call fired).
const UserSessionSchema = new mongoose.Schema({
  user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:            { type: String, required: true },
  loginAt:         { type: Date, default: Date.now },
  logoutAt:        { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },
  ip:              { type: String, default: '' },
  location:        { // approximate, derived from IP — for admin's "where are they logging in from"
    city:    { type: String, default: '' },
    region:  { type: String, default: '' },
    country: { type: String, default: '' },
    label:   { type: String, default: '' },
  },
  userAgent:       { type: String, default: '' },
  active:          { type: Boolean, default: true },
}, { timestamps: true });

UserSessionSchema.index({ user: 1, loginAt: -1 });
UserSessionSchema.index({ active: 1 });

module.exports = mongoose.model('UserSession', UserSessionSchema);
