// const mongoose = require('mongoose');

// const ChatMessageSchema = new mongoose.Schema({
//   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   senderName: { type: String },
//   senderRole: { type: String },
//   receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   room: { type: String, default: 'general' }, // 'general', 'doctors', 'nurses', 'dm_userId1_userId2'
//   message: { type: String, required: true },
//   type: { type: String, enum: ['text','system','image'], default: 'text' },
//   readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
//   edited: { type: Boolean, default: false },
// }, { timestamps: true });

// module.exports = mongoose.model('ChatMessage', ChatMessageSchema);


const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  sender:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  senderName: { type: String },
  senderRole: { type: String },
  receiver:   { type: mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  message:    { type: String, required:true },
  room:       { type: String, default:'general' },
  read:       { type: Boolean, default:false },
}, { timestamps:true });
module.exports = mongoose.model('ChatMessage', ChatSchema);
