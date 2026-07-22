// const mongoose = require('mongoose');

// const TaskSchema = new mongoose.Schema({
//   title:       { type: String, required: true },
//   description: { type: String, default: '' },
//   assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   dueDate:     { type: Date },
//   priority:    { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
//   status:      { type: String, enum: ['pending','in_progress','completed','cancelled'], default: 'pending' },
//   category:    { type: String, enum: ['clinical','administrative','maintenance','cleaning','pharmacy','security','it','biomedical','transport','reception','other'], default: 'other' },
//   completedAt: { type: Date },
//   notes:       { type: String, default: '' },
//   room:        { type: mongoose.Schema.Types.ObjectId, ref: 'OTRoom', default: null },
// }, { timestamps: true });

// // Index for fast per-user queries
// TaskSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
// TaskSchema.index({ assignedBy: 1, createdAt: -1 });

// module.exports = mongoose.model('Task', TaskSchema);


const mongoose = require('mongoose');
const TaskSchema = new mongoose.Schema({
  title:       { type: String, required:true },
  description: { type: String, default:'' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  dueDate:     { type: Date },
  priority:    { type: String, enum:['low','medium','high','urgent'], default:'medium' },
  status:      { type: String, enum:['pending','in_progress','completed','cancelled'], default:'pending' },
  category:    { type: String, enum:['clinical','administrative','maintenance','cleaning','pharmacy','transport','other'], default:'other' },
  completedAt: { type: Date },
  notes:       { type: String, default:'' },
  room:        { type: mongoose.Schema.Types.ObjectId, ref:'OTRoom', default:null },
}, { timestamps:true });
module.exports = mongoose.model('Task', TaskSchema);
