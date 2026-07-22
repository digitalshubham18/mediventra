// const mongoose = require('mongoose');

// const ScheduleSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   role: { type: String, required: true },
//   date: { type: Date, required: true },
//   shift: { type: String, enum: ['morning','afternoon','night','full'], default: 'morning' },
//   startTime: { type: String, default: '08:00' },
//   endTime: { type: String, default: '16:00' },
//   department: { type: String, default: '' },
//   room: { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', default: null },
//   task: { type: String, default: '' },
//   status: { type: String, enum: ['scheduled','completed','absent','on-leave'], default: 'scheduled' },
//   notes: { type: String, default: '' },
// }, { timestamps: true });

// module.exports = mongoose.model('Schedule', ScheduleSchema);

const mongoose = require('mongoose');
const ScheduleSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  role:       { type: String, required:true },
  date:       { type: Date, required:true },
  shift:      { type: String, enum:['morning','afternoon','night','full'], default:'morning' },
  startTime:  { type: String, default:'08:00' },
  endTime:    { type: String, default:'16:00' },
  department: { type: String, default:'' },
  task:       { type: String, default:'' },
  status:     { type: String, enum:['scheduled','completed','absent','on-leave'], default:'scheduled' },
  notes:      { type: String, default:'' },
  room:       { type: mongoose.Schema.Types.ObjectId, ref:'OTRoom', default:null },
}, { timestamps:true });
module.exports = mongoose.model('Schedule', ScheduleSchema);
