const mongoose = require('mongoose');
const AnnouncementSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  content:    { type: String, required: true },
  type:       { type: String, enum: ['general','emergency','maintenance','holiday','event','pinned'], default: 'general' },
  priority:   { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
  pinned:     { type: Boolean, default: false },
  pinnedAt:   { type: Date },
  pinnedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetRoles:{ type: [String], default: [] }, // empty = all roles
  expiresAt:  { type: Date },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attachments:[String],
}, { timestamps: true });
module.exports = mongoose.model('Announcement', AnnouncementSchema);
