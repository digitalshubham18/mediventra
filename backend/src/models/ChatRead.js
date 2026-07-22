const mongoose = require('mongoose');

// Tracks, per user and per room, the last time that user viewed the
// conversation — this is what powers unread badges. A single global
// 'read' flag on each message (as ChatMessage briefly had, unused)
// doesn't work for channels shared by many people: one viewer opening
// #general would incorrectly mark it read for everyone else too.
const ChatReadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: String, required: true },
  lastReadAt: { type: Date, default: Date.now },
});

ChatReadSchema.index({ user: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('ChatRead', ChatReadSchema);
