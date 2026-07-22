const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password:      { type: String, required: true, minlength: 6, select: false },
  role: {
    type: String,
    enum: ['admin','doctor','patient','nurse','pharmacist','wardboy','sweeper','otboy',
           'finance','electrician','plumber','it_technician','equipment_tech',
           'biomedical','security','receptionist','ambulance_driver','lab_technician',
           'radiology_tech','dialysis_tech'],
    default: 'patient'
  },
  status:        { type: String, enum: ['pending','approved','suspended'], default: 'pending' },
  phone:         { type: String, default: '' },
  department:    { type: String, default: '' },
  specialization:{ type: String, default: '' },
  licenseNumber: { type: String, default: '' },
  bloodGroup:    { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-',''], default: '' },
  weight:        { type: Number }, // kg
  height:        { type: Number }, // cm
  preferredLanguage: { type: String, enum: ['en'], default: 'en' },
  address:       { type: String, default: '' },
  avatar:        { type: String, default: '' },
  age:           { type: Number },
  gender:        { type: String, default: '' },
  // Real, clinically-recorded vitals from an actual hospital visit —
  // deliberately has NO default values. Shown on the patient's dashboard
  // as "Not recorded yet" until a doctor/nurse/admin records a real
  // reading; never pre-filled with placeholder numbers.
  currentVitals: {
    bloodPressure: { type: String, default: '' }, // e.g. "120/80"
    pulse:         { type: Number },               // bpm
    temperature:   { type: Number },                // °F
    spo2:          { type: Number },                // %
    recordedAt:    { type: Date },
    recordedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByName:{ type: String, default: '' },
  },
  // Known allergies — free-text list, checked against prescribed
  // medicines by the Cross-Interaction Alerts feature on the doctor's
  // prescription screen.
  allergies: { type: [String], default: [] },

  // Fitbit OAuth2 tokens — only populated if the patient connects their
  // account via Wearable Sync. Apple Health has no equivalent (no web
  // API exists for it at all); Garmin requires enterprise partnership
  // approval, so Fitbit is the one real integration offered.
  fitbitAccessToken:  { type: String, select: false },
  fitbitRefreshToken: { type: String, select: false },
  fitbitConnectedAt:  { type: Date },
  // Google Fit — a second real wearable OAuth option (Android phones,
  // Wear OS, and Samsung Health/most Android fitness apps can all sync
  // into Google Fit, so this covers a lot of ground beyond just Fitbit
  // devices). Same "needs a free developer app" caveat as Fitbit below.
  googleFitAccessToken:  { type: String, select: false },
  googleFitRefreshToken: { type: String, select: false },
  googleFitConnectedAt:  { type: Date },

  // OAuth login — set when the account was created/linked via "Continue
  // with Google/GitHub" instead of email+password. Password is still
  // set (a random one, generated automatically) so the schema stays
  // consistent; the user simply never needs it unless they later use
  // "Forgot Password".
  googleId: { type: String, select: false },
  githubId: { type: String, select: false },

  joiningDate:   { type: Date, default: Date.now },
  emailVerified: { type: Boolean, default: false },
  // Set when a doctor/nurse/admin adds a patient directly (see
  // userController.createPatient) rather than the patient self-registering.
  createdByStaff:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isOnline:      { type: Boolean, default: false },
  lastSeen:      { type: Date },
  rating:        { type: Number, default: null, min: 1, max: 5 }, // null = no real reviews yet; never show a fabricated number
  bankAccount:   { type: String, default: '' },
  // ── Doctor profile (real, editable — replaces the old hardcoded
  // "AIIMS New Delhi / PGI Chandigarh" sample data shown to admins) ──────
  bio:            { type: String, default: '' },
  degrees:        [{ institution: String, degree: String, year: String }],
  experiences:    [{ text: String }],
  experienceYears:{ type: Number, default: null }, // distinct from `age` — previously the UI mislabeled age as years of experience
  // ── Documentation / Onboarding fields ──────────────────────────────
  bankDetails: {
    accountNumber: { type: String, default: '' },
    ifsc:          { type: String, default: '' },
    bankName:      { type: String, default: '' },
    accountHolder: { type: String, default: '' },
  },
  emergencyContact: {
    name:         { type: String, default: '' },
    phone:        { type: String, default: '' },
    relationship: { type: String, default: '' },
  },
  govtId: {
    type:   { type: String, enum: ['aadhaar','pan','passport',''], default: '' },
    number: { type: String, default: '' },
  },
  profilePhoto:       { type: String, default: '' },
  documentationStatus:{ type: String, enum: ['incomplete','complete'], default: 'incomplete' },
  notificationPrefs: {
    appointments:  { type: Boolean, default: true },
    reminders:     { type: Boolean, default: true },
    emergency:     { type: Boolean, default: true },
    salary:        { type: Boolean, default: true },
    emailNotifs:   { type: Boolean, default: true },
    smsNotifs:     { type: Boolean, default: false },
    pushNotifs:    { type: Boolean, default: true },
    twoFA:         { type: Boolean, default: false },
    autoLogout:    { type: Boolean, default: true },
  },
  resetPasswordToken:  { type: String, select: false },
  resetPasswordExpire: { type: Date,   select: false },
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function(entered) {
  return bcrypt.compare(entered, this.password);
};

UserSchema.methods.getJWT = function() {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

module.exports = mongoose.model('User', UserSchema);
