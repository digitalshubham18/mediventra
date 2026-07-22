// const mongoose = require('mongoose');

// const OTRoomSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   type: { type: String, enum: ['OT','ICU','Ward','General','Emergency','Recovery'], default: 'OT' },
//   number: { type: String, required: true },
//   floor: { type: Number, default: 1 },
//   capacity: { type: Number, default: 1 },
//   occupiedBeds: { type: Number, default: 0 },
//   status: { type: String, enum: ['available','occupied','maintenance','cleaning','reserved'], default: 'available' },
//   assignedPatient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   assignedNurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   equipment: [String],
//   notes: { type: String, default: '' },
//   lastCleaned: { type: Date, default: Date.now },
//   cleanedBy: { type: String, default: '' },
// }, { timestamps: true });

// module.exports = mongoose.model('OTRoom', OTRoomSchema);


const mongoose = require('mongoose');
const OTRoomSchema = new mongoose.Schema({
  name:            { type: String, required:true },
  number:          { type: String, required:true },
  type:            { type: String, enum:['OT','ICU','Ward','General','Emergency','Recovery','Isolation','Lab','Radiology'], default:'General' },
  status:          { type: String, enum:['available','occupied','maintenance','cleaning','reserved'], default:'available' },
  floor:           { type: Number, default:1 },
  capacity:        { type: Number, default:1 },
  occupiedBeds:    { type: Number, default:0 },
  assignedPatient: { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  assignedDoctor:  { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  assignedNurse:   { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  assignedWardboy: { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  equipment:       [String],
  notes:           { type: String, default:'' },
  cleanedBy:       { type: String, default:'' },
  lastCleaned:     { type: Date },
}, { timestamps:true });
module.exports = mongoose.model('OTRoom', OTRoomSchema);
