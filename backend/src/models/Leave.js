// const mongoose = require('mongoose');

// const LeaveSchema = new mongoose.Schema({
//   user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type:        { type: String, enum: ['casual','sick','earned','maternity','paternity','emergency','halfday','unpaid'], required: true },
//   from:        { type: Date, required: true },
//   to:          { type: Date, required: true },
//   days:        { type: Number, default: 1 },
//   reason:      { type: String, required: true },
//   status:      { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
//   reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   reviewNote:  { type: String, default: '' },
//   reviewedAt:  { type: Date },
//   document:    { type: String, default: '' }, // URL to uploaded doc (for sick/medical)
//   isOnLeave:   { type: Boolean, default: false }, // true when currently on leave
// }, { timestamps: true });

// module.exports = mongoose.model('Leave', LeaveSchema);

// const mongoose = require('mongoose');

// const LeaveSchema = new mongoose.Schema({
//   user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type:        { type: String, enum: ['casual','sick','earned','maternity','paternity','emergency','halfday','unpaid'], required: true },
//   from:        { type: Date, required: true },
//   to:          { type: Date, required: true },
//   days:        { type: Number, default: 1 },
//   reason:      { type: String, required: true },
//   status:      { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
//   reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   reviewNote:  { type: String, default: '' },
//   reviewedAt:  { type: Date },
//   document:    { type: String, default: '' }, // URL to uploaded doc (for sick/medical)
//   isOnLeave:   { type: Boolean, default: false }, // true when currently on leave
// }, { timestamps: true });

// module.exports = mongoose.model('Leave', LeaveSchema);


const mongoose = require('mongoose');
const LeaveSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type:       { type: String, enum:['casual','sick','earned','maternity','paternity','emergency','halfday','unpaid'], required:true },
  from:       { type: Date, required:true },
  to:         { type: Date, required:true },
  days:       { type: Number, default:1 },
  reason:     { type: String, required:true },
  status:     { type: String, enum:['pending','approved','rejected'], default:'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  reviewNote: { type: String, default:'' },
  reviewedAt: { type: Date },
  isOnLeave:  { type: Boolean, default:false },
}, { timestamps:true });
module.exports = mongoose.model('Leave', LeaveSchema);
