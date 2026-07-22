

// const OTRoom = require('../models/OTRoom');
// const Schedule = require('../models/Schedule');
// const ChatMessage = require('../models/ChatMessage');
// const User = require('../models/User');

// // ─── OT ROOMS ─────────────────────────────────────────────────────────────
// exports.getRooms = async (req, res) => {
//   try {
//     const q = {};
//     if (req.query.type)   q.type   = req.query.type;
//     if (req.query.status) q.status = req.query.status;
//     const rooms = await OTRoom.find(q)
//       .populate('assignedPatient','name bloodGroup')
//       .populate('assignedDoctor','name specialization')
//       .populate('assignedNurse','name')
//       .sort({ type:1, number:1 });
//     res.json({ success:true, count:rooms.length, data:rooms });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.create(req.body);
//     res.status(201).json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.findByIdAndUpdate(req.params.id, req.body, { new:true })
//       .populate('assignedPatient','name').populate('assignedDoctor','name').populate('assignedNurse','name');
//     if (!room) return res.status(404).json({ success:false, error:'Room not found' });
//     const io = req.app.get('io');
//     if (io) io.emit('room_updated', { roomId:room._id, status:room.status, name:room.name });
//     res.json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteRoom = async (req, res) => {
//   try {
//     await OTRoom.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Room deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── SCHEDULES ────────────────────────────────────────────────────────────
// // CRITICAL: always scope to current user UNLESS admin + explicit userId param OR all query

// exports.getSchedules = async (req, res) => {
//   try {
//     const isAdmin = req.user.role === 'admin';
//     const q = {};

//     // Scope: non-admin always gets own schedule only
//     // Admin can query all (no userId param) or specific user (userId param)
//     if (!isAdmin) {
//       q.user = req.user.id;
//     } else if (req.query.userId) {
//       q.user = req.query.userId;
//     }
//     // Admin with no userId gets all (for timetable admin view)

//     if (req.query.role) q.role = req.query.role;
//     if (req.query.date) {
//       const d = new Date(req.query.date);
//       q.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(new Date(req.query.date).setHours(23,59,59,999)) };
//     }
//     if (req.query.week) {
//       const start = new Date(req.query.week);
//       const end = new Date(start); end.setDate(end.getDate()+7);
//       q.date = { $gte: start, $lt: end };
//     }

//     const schedules = await Schedule.find(q)
//       .populate('user','name role department')
//       .populate('room','name number type')
//       .sort({ date:1 });
//     res.json({ success:true, count:schedules.length, data:schedules });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.create(req.body);
//     await schedule.populate('user','name role');
//     const io = req.app.get('io');
//     if (io) io.to(`user_${req.body.user}`).emit('schedule_assigned', { title:'New shift assigned', date:req.body.date });
//     res.status(201).json({ success:true, data:schedule });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.bulkSeedSchedules = async (req, res) => {
//   try {
//     const { schedules } = req.body;
//     await Schedule.insertMany(schedules);
//     res.status(201).json({ success:true, count:schedules.length });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('user','name role');
//     if (!schedule) return res.status(404).json({ success:false, error:'Schedule not found' });
//     res.json({ success:true, data:schedule });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteSchedule = async (req, res) => {
//   try {
//     await Schedule.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── CHAT ─────────────────────────────────────────────────────────────────
// exports.getMessages = async (req, res) => {
//   try {
//     const { room='general', limit=50, before } = req.query;
//     const q = { room };
//     if (before) q.createdAt = { $lt: new Date(before) };
//     const msgs = await ChatMessage.find(q)
//       .populate('sender','name role avatar')
//       .sort({ createdAt:-1 })
//       .limit(parseInt(limit));
//     res.json({ success:true, data:msgs.reverse() });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.sendMessage = async (req, res) => {
//   try {
//     const { message, room='general', receiver } = req.body;
//     const msg = await ChatMessage.create({
//       sender: req.user.id, senderName: req.user.name,
//       senderRole: req.user.role, message, room, receiver: receiver||null,
//     });
//     await msg.populate('sender','name role avatar');
//     const io = req.app.get('io');
//     if (io) {
//       io.to(room).emit('new_message', msg);
//       if (receiver) io.to(`user_${receiver}`).emit('new_message', msg);
//     }
//     res.status(201).json({ success:true, data:msg });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.getUsers = async (req, res) => {
//   try {
//     const q = { status:'approved', _id:{ $ne:req.user.id } };
//     // Ward boys and nurses can only chat with doctors and admins (not patients)
//     if (['wardboy','sweeper','otboy','nurse'].includes(req.user.role)) {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     // Patients cannot see patient list in chat (can see doctors and admins)
//     if (req.user.role === 'patient') {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     const users = await User.find(q)
//       .select('name role department isOnline lastSeen avatar')
//       .sort({ isOnline:-1, name:1 });
//     res.json({ success:true, data:users });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };


// const OTRoom = require('../models/OTRoom');
// const Schedule = require('../models/Schedule');
// const ChatMessage = require('../models/ChatMessage');
// const User = require('../models/User');

// // ─── OT ROOMS ─────────────────────────────────────────────────────────────
// exports.getRooms = async (req, res) => {
//   try {
//     const q = {};
//     if (req.query.type)   q.type   = req.query.type;
//     if (req.query.status) q.status = req.query.status;
//     const rooms = await OTRoom.find(q)
//       .populate('assignedPatient','name bloodGroup')
//       .populate('assignedDoctor','name specialization')
//       .populate('assignedNurse','name')
//       .sort({ type:1, number:1 });
//     res.json({ success:true, count:rooms.length, data:rooms });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.create(req.body);
//     res.status(201).json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.findByIdAndUpdate(req.params.id, req.body, { new:true })
//       .populate('assignedPatient','name').populate('assignedDoctor','name').populate('assignedNurse','name');
//     if (!room) return res.status(404).json({ success:false, error:'Room not found' });
//     const io = req.app.get('io');
//     if (io) io.emit('room_updated', { roomId:room._id, status:room.status, name:room.name });
//     res.json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteRoom = async (req, res) => {
//   try {
//     await OTRoom.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Room deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── SCHEDULES ────────────────────────────────────────────────────────────
// // CRITICAL: always scope to current user UNLESS admin + explicit userId param OR all query

// exports.getSchedules = async (req, res) => {
//   try {
//     const isAdmin = req.user.role === 'admin';
//     const q = {};

//     // Scope: non-admin always gets own schedule only
//     // Admin can query all (no userId param) or specific user (userId param)
//     if (!isAdmin) {
//       q.user = req.user.id;
//     } else if (req.query.userId) {
//       q.user = req.query.userId;
//     }
//     // Admin with no userId gets all (for timetable admin view)

//     if (req.query.role) q.role = req.query.role;
//     if (req.query.date) {
//       const d = new Date(req.query.date);
//       q.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(new Date(req.query.date).setHours(23,59,59,999)) };
//     }
//     if (req.query.week) {
//       const start = new Date(req.query.week);
//       const end = new Date(start); end.setDate(end.getDate()+7);
//       q.date = { $gte: start, $lt: end };
//     }

//     const schedules = await Schedule.find(q)
//       .populate('user','name role department')
//       .populate('room','name number type')
//       .sort({ date:1 });
//     res.json({ success:true, count:schedules.length, data:schedules });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.create(req.body);
//     await schedule.populate('user','name role');
//     const io = req.app.get('io');
//     if (io) io.to(`user_${req.body.user}`).emit('schedule_assigned', { title:'New shift assigned', date:req.body.date });
//     res.status(201).json({ success:true, data:schedule });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.bulkSeedSchedules = async (req, res) => {
//   try {
//     const { schedules } = req.body;
//     await Schedule.insertMany(schedules);
//     res.status(201).json({ success:true, count:schedules.length });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.findById(req.params.id);
//     if (!schedule) return res.status(404).json({ success:false, error:'Schedule not found' });
//     // Non-admins can only update their own schedule
//     if (req.user.role !== 'admin' && schedule.user.toString() !== req.user.id) {
//       return res.status(403).json({ success:false, error:'You can only update your own schedule' });
//     }
//     const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('user','name role');
//     res.json({ success:true, data:updated });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteSchedule = async (req, res) => {
//   try {
//     await Schedule.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── CHAT ─────────────────────────────────────────────────────────────────
// exports.getMessages = async (req, res) => {
//   try {
//     const { room='general', limit=50, before } = req.query;
//     const q = { room };
//     if (before) q.createdAt = { $lt: new Date(before) };
//     const msgs = await ChatMessage.find(q)
//       .populate('sender','name role avatar')
//       .sort({ createdAt:-1 })
//       .limit(parseInt(limit));
//     res.json({ success:true, data:msgs.reverse() });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.sendMessage = async (req, res) => {
//   try {
//     const { message, room='general', receiver } = req.body;
//     const msg = await ChatMessage.create({
//       sender: req.user.id, senderName: req.user.name,
//       senderRole: req.user.role, message, room, receiver: receiver||null,
//     });
//     await msg.populate('sender','name role avatar');
//     const io = req.app.get('io');
//     if (io) {
//       io.to(room).emit('new_message', msg);
//       if (receiver) io.to(`user_${receiver}`).emit('new_message', msg);
//     }
//     res.status(201).json({ success:true, data:msg });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.getUsers = async (req, res) => {
//   try {
//     const q = { status:'approved', _id:{ $ne:req.user.id } };
//     // Ward boys and nurses can only chat with doctors and admins (not patients)
//     if (['wardboy','sweeper','otboy','nurse'].includes(req.user.role)) {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     // Patients cannot see patient list in chat (can see doctors and admins)
//     if (req.user.role === 'patient') {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     const users = await User.find(q)
//       .select('name role department isOnline lastSeen avatar')
//       .sort({ isOnline:-1, name:1 });
//     res.json({ success:true, data:users });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };


// const OTRoom = require('../models/OTRoom');
// const Schedule = require('../models/Schedule');
// const ChatMessage = require('../models/ChatMessage');
// const User = require('../models/User');

// // ─── OT ROOMS ─────────────────────────────────────────────────────────────
// exports.getRooms = async (req, res) => {
//   try {
//     const q = {};
//     if (req.query.type)   q.type   = req.query.type;
//     if (req.query.status) q.status = req.query.status;
//     const rooms = await OTRoom.find(q)
//       .populate('assignedPatient','name bloodGroup')
//       .populate('assignedDoctor','name specialization')
//       .populate('assignedNurse','name')
//       .sort({ type:1, number:1 });
//     res.json({ success:true, count:rooms.length, data:rooms });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.create(req.body);
//     res.status(201).json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateRoom = async (req, res) => {
//   try {
//     const prevRoom = await OTRoom.findById(req.params.id);
//     const room = await OTRoom.findByIdAndUpdate(req.params.id, req.body, { new:true })
//       .populate('assignedPatient','name').populate('assignedDoctor','name').populate('assignedNurse','name');
//     if (!room) return res.status(404).json({ success:false, error:'Room not found' });
//     const io = req.app.get('io');
//     if (io) {
//       // Always emit general room update
//       io.emit('room_updated', {
//         roomId:   room._id,
//         status:   room.status,
//         name:     room.name,
//         number:   room.number,
//         type:     room.type,
//         floor:    room.floor,
//       });
//       // Emit specific maintenance event (non-patient only — filtered client-side)
//       if (room.status === 'maintenance' && prevRoom?.status !== 'maintenance') {
//         io.emit('room_maintenance', {
//           roomId:      room._id,
//           name:        room.name,
//           number:      room.number,
//           type:        room.type,
//           floor:       room.floor,
//           notes:       room.notes || '',
//           updatedBy:   req.user?.name || 'Admin',
//           startedAt:   new Date(),
//         });
//       }
//       // Emit when maintenance ends
//       if (prevRoom?.status === 'maintenance' && room.status !== 'maintenance') {
//         io.emit('room_maintenance_end', {
//           roomId:    room._id,
//           name:      room.name,
//           number:    room.number,
//           newStatus: room.status,
//           updatedBy: req.user?.name || 'Admin',
//         });
//       }
//     }
//     res.json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteRoom = async (req, res) => {
//   try {
//     await OTRoom.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Room deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── SCHEDULES ────────────────────────────────────────────────────────────
// // CRITICAL: always scope to current user UNLESS admin + explicit userId param OR all query

// exports.getSchedules = async (req, res) => {
//   try {
//     const isAdmin = req.user.role === 'admin';
//     const q = {};

//     // Scope: non-admin always gets own schedule only
//     // Admin can query all (no userId param) or specific user (userId param)
//     if (!isAdmin) {
//       q.user = req.user.id;
//     } else if (req.query.userId) {
//       q.user = req.query.userId;
//     }
//     // Admin with no userId gets all (for timetable admin view)

//     if (req.query.role) q.role = req.query.role;
//     if (req.query.date) {
//       const d = new Date(req.query.date);
//       q.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(new Date(req.query.date).setHours(23,59,59,999)) };
//     }
//     if (req.query.week) {
//       const start = new Date(req.query.week);
//       const end = new Date(start); end.setDate(end.getDate()+7);
//       q.date = { $gte: start, $lt: end };
//     }

//     const schedules = await Schedule.find(q)
//       .populate('user','name role department')
//       .populate('room','name number type')
//       .sort({ date:1 });
//     res.json({ success:true, count:schedules.length, data:schedules });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.create(req.body);
//     await schedule.populate('user','name role');
//     const io = req.app.get('io');
//     if (io) io.to(`user_${req.body.user}`).emit('schedule_assigned', { title:'New shift assigned', date:req.body.date });
//     res.status(201).json({ success:true, data:schedule });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.bulkSeedSchedules = async (req, res) => {
//   try {
//     const { schedules } = req.body;
//     await Schedule.insertMany(schedules);
//     res.status(201).json({ success:true, count:schedules.length });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.findById(req.params.id);
//     if (!schedule) return res.status(404).json({ success:false, error:'Schedule not found' });
//     // Non-admins can only update their own schedule
//     if (req.user.role !== 'admin' && schedule.user.toString() !== req.user.id) {
//       return res.status(403).json({ success:false, error:'You can only update your own schedule' });
//     }
//     const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('user','name role');
//     res.json({ success:true, data:updated });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteSchedule = async (req, res) => {
//   try {
//     await Schedule.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── CHAT ─────────────────────────────────────────────────────────────────
// exports.getMessages = async (req, res) => {
//   try {
//     const { room='general', limit=50, before } = req.query;
//     const q = { room };
//     if (before) q.createdAt = { $lt: new Date(before) };
//     const msgs = await ChatMessage.find(q)
//       .populate('sender','name role avatar')
//       .sort({ createdAt:-1 })
//       .limit(parseInt(limit));
//     res.json({ success:true, data:msgs.reverse() });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.sendMessage = async (req, res) => {
//   try {
//     const { message, room='general', receiver } = req.body;
//     const msg = await ChatMessage.create({
//       sender: req.user.id, senderName: req.user.name,
//       senderRole: req.user.role, message, room, receiver: receiver||null,
//     });
//     await msg.populate('sender','name role avatar');
//     const io = req.app.get('io');
//     if (io) {
//       io.to(room).emit('new_message', msg);
//       if (receiver) io.to(`user_${receiver}`).emit('new_message', msg);
//     }
//     res.status(201).json({ success:true, data:msg });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.getUsers = async (req, res) => {
//   try {
//     const q = { status:'approved', _id:{ $ne:req.user.id } };
//     // Ward boys and nurses can only chat with doctors and admins (not patients)
//     if (['wardboy','sweeper','otboy','nurse'].includes(req.user.role)) {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     // Patients cannot see patient list in chat (can see doctors and admins)
//     if (req.user.role === 'patient') {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     const users = await User.find(q)
//       .select('name role department isOnline lastSeen avatar')
//       .sort({ isOnline:-1, name:1 });
//     res.json({ success:true, data:users });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };


// const OTRoom = require('../models/OTRoom');
// const Schedule = require('../models/Schedule');
// const ChatMessage = require('../models/ChatMessage');
// const User = require('../models/User');

// // ─── OT ROOMS ─────────────────────────────────────────────────────────────
// exports.getRooms = async (req, res) => {
//   try {
//     const q = {};
//     if (req.query.type)   q.type   = req.query.type;
//     if (req.query.status) q.status = req.query.status;
//     const rooms = await OTRoom.find(q)
//       .populate('assignedPatient','name bloodGroup')
//       .populate('assignedDoctor','name specialization')
//       .populate('assignedNurse','name')
//       .sort({ type:1, number:1 });
//     res.json({ success:true, count:rooms.length, data:rooms });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createRoom = async (req, res) => {
//   try {
//     const room = await OTRoom.create(req.body);
//     res.status(201).json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateRoom = async (req, res) => {
//   try {
//     const prevRoom = await OTRoom.findById(req.params.id);
//     const room = await OTRoom.findByIdAndUpdate(req.params.id, req.body, { new:true })
//       .populate('assignedPatient','name').populate('assignedDoctor','name').populate('assignedNurse','name');
//     if (!room) return res.status(404).json({ success:false, error:'Room not found' });
//     const io = req.app.get('io');
//     if (io) {
//       // Always emit general room update
//       io.emit('room_updated', {
//         roomId:   room._id,
//         status:   room.status,
//         name:     room.name,
//         number:   room.number,
//         type:     room.type,
//         floor:    room.floor,
//       });
//       // Emit specific maintenance event (non-patient only — filtered client-side)
//       if (room.status === 'maintenance' && prevRoom?.status !== 'maintenance') {
//         io.emit('room_maintenance', {
//           roomId:      room._id,
//           name:        room.name,
//           number:      room.number,
//           type:        room.type,
//           floor:       room.floor,
//           notes:       room.notes || '',
//           updatedBy:   req.user?.name || 'Admin',
//           startedAt:   new Date(),
//         });
//       }
//       // Emit when maintenance ends
//       if (prevRoom?.status === 'maintenance' && room.status !== 'maintenance') {
//         io.emit('room_maintenance_end', {
//           roomId:    room._id,
//           name:      room.name,
//           number:    room.number,
//           newStatus: room.status,
//           updatedBy: req.user?.name || 'Admin',
//         });
//       }
//     }
//     res.json({ success:true, data:room });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteRoom = async (req, res) => {
//   try {
//     await OTRoom.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Room deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── SCHEDULES ────────────────────────────────────────────────────────────
// // CRITICAL: always scope to current user UNLESS admin + explicit userId param OR all query

// exports.getSchedules = async (req, res) => {
//   try {
//     const isAdmin = req.user.role === 'admin';
//     const q = {};

//     // Scope: non-admin always gets own schedule only
//     // Admin can query all (no userId param) or specific user (userId param)
//     if (!isAdmin) {
//       q.user = req.user.id;
//     } else if (req.query.userId) {
//       q.user = req.query.userId;
//     }
//     // Admin with no userId gets all (for timetable admin view)

//     if (req.query.role) q.role = req.query.role;
//     if (req.query.date) {
//       const d = new Date(req.query.date);
//       q.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(new Date(req.query.date).setHours(23,59,59,999)) };
//     }
//     if (req.query.week) {
//       const start = new Date(req.query.week);
//       const end = new Date(start); end.setDate(end.getDate()+7);
//       q.date = { $gte: start, $lt: end };
//     }

//     const schedules = await Schedule.find(q)
//       .populate('user','name role department')
//       .populate('room','name number type')
//       .sort({ date:1 });
//     res.json({ success:true, count:schedules.length, data:schedules });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.createSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.create(req.body);
//     await schedule.populate('user','name role');
//     const io = req.app.get('io');
//     if (io) io.to(`user_${req.body.user}`).emit('schedule_assigned', { title:'New shift assigned', date:req.body.date });
//     res.status(201).json({ success:true, data:schedule });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.bulkSeedSchedules = async (req, res) => {
//   try {
//     const { schedules } = req.body;
//     await Schedule.insertMany(schedules);
//     res.status(201).json({ success:true, count:schedules.length });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.updateSchedule = async (req, res) => {
//   try {
//     const schedule = await Schedule.findById(req.params.id);
//     if (!schedule) return res.status(404).json({ success:false, error:'Schedule not found' });
//     // Non-admins can only update their own schedule
//     if (req.user.role !== 'admin' && schedule.user.toString() !== req.user.id) {
//       return res.status(403).json({ success:false, error:'You can only update your own schedule' });
//     }
//     const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('user','name role');
//     res.json({ success:true, data:updated });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.deleteSchedule = async (req, res) => {
//   try {
//     await Schedule.findByIdAndDelete(req.params.id);
//     res.json({ success:true, message:'Deleted' });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// // ─── CHAT ─────────────────────────────────────────────────────────────────
// exports.getMessages = async (req, res) => {
//   try {
//     const { room='general', limit=50, before } = req.query;
//     const q = { room };
//     if (before) q.createdAt = { $lt: new Date(before) };
//     const msgs = await ChatMessage.find(q)
//       .populate('sender','name role avatar')
//       .sort({ createdAt:-1 })
//       .limit(parseInt(limit));
//     res.json({ success:true, data:msgs.reverse() });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.sendMessage = async (req, res) => {
//   try {
//     const { message, room='general', receiver } = req.body;
//     const msg = await ChatMessage.create({
//       sender: req.user.id, senderName: req.user.name,
//       senderRole: req.user.role, message, room, receiver: receiver||null,
//     });
//     await msg.populate('sender','name role avatar');
//     const io = req.app.get('io');
//     if (io) {
//       io.to(room).emit('new_message', msg);
//       if (receiver) io.to(`user_${receiver}`).emit('new_message', msg);
//     }
//     res.status(201).json({ success:true, data:msg });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

// exports.getUsers = async (req, res) => {
//   try {
//     const q = { status:'approved', _id:{ $ne:req.user.id } };
//     // Ward boys and nurses can only chat with doctors and admins (not patients)
//     if (['wardboy','sweeper','otboy','nurse'].includes(req.user.role)) {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     // Patients cannot see patient list in chat (can see doctors and admins)
//     if (req.user.role === 'patient') {
//       q.role = { $in: ['doctor','admin','nurse'] };
//     }
//     const users = await User.find(q)
//       .select('name role department isOnline lastSeen avatar')
//       .sort({ isOnline:-1, name:1 });
//     res.json({ success:true, data:users });
//   } catch(e) { res.status(500).json({ success:false, error:e.message }); }
// };

const OTRoom      = require('../models/OTRoom');
const Schedule    = require('../models/Schedule');
const ChatMessage = require('../models/ChatMessage');
const ChatRead    = require('../models/ChatRead');
const User        = require('../models/User');
const Appointment = require('../models/Appointment');
const { logAction } = require('../utils/auditLog');

// ── ROOMS ─────────────────────────────────────────────────────────────

exports.getRooms = async (req, res) => {
  try {
    const q = {};
    if (req.query.type)   q.type   = req.query.type;
    if (req.query.status) q.status = req.query.status;
    const rooms = await OTRoom.find(q)
      .populate('assignedPatient','name bloodGroup')
      .populate('assignedDoctor','name specialization')
      .populate('assignedNurse','name')
      .sort({ floor:1, type:1, number:1 });
    res.json({ success:true, count:rooms.length, data:rooms });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.createRoom = async (req, res) => {
  try {
    const room = await OTRoom.create(req.body);
    res.status(201).json({ success:true, data:room });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.updateRoom = async (req, res) => {
  try {
    const prevRoom = await OTRoom.findById(req.params.id);

    // '' is sent by the frontend's "— No doctor assigned —" option, but
    // Mongoose can't cast an empty string to ObjectId — that threw an
    // uncaught CastError (500) any time a room was unassigned. Treat
    // empty string as "clear this field" instead.
    const body = { ...req.body };
    ['assignedDoctor','assignedPatient','assignedNurse','assignedWardboy'].forEach(k => {
      if (body[k] === '') body[k] = null;
    });

    const room = await OTRoom.findByIdAndUpdate(req.params.id, body, { new:true })
      .populate('assignedPatient','name').populate('assignedDoctor','name').populate('assignedNurse','name');
    if (!room) return res.status(404).json({ success:false, error:'Room not found' });

    const io = req.app.get('io');
    if (io) {
      io.emit('room_updated', { roomId:room._id, status:room.status, name:room.name, number:room.number, type:room.type, floor:room.floor });
      // Fire maintenance events (filtered client-side — patients won't see it)
      if (room.status === 'maintenance' && prevRoom?.status !== 'maintenance') {
        io.emit('room_maintenance', {
          roomId:room._id, name:room.name, number:room.number,
          type:room.type, floor:room.floor, notes:room.notes||'',
          updatedBy: req.user?.name || 'Admin', startedAt: new Date(),
        });
      }
      if (prevRoom?.status === 'maintenance' && room.status !== 'maintenance') {
        io.emit('room_maintenance_end', { roomId:room._id, name:room.name, number:room.number, newStatus:room.status, updatedBy:req.user?.name||'Admin' });
      }
    }

    // Log doctor reassignment specifically — this is the action the
    // admin-warning confirm dialog guards, worth a clear audit trail entry.
    const prevDoctorId = prevRoom?.assignedDoctor?.toString();
    const newDoctorId  = room.assignedDoctor?._id?.toString();
    if (prevDoctorId !== newDoctorId) {
      logAction({
        actor: req.user, action: 'room_assigned',
        description: newDoctorId
          ? `Assigned Room ${room.number} to Dr. ${room.assignedDoctor?.name || 'Unknown'}${prevDoctorId ? ' (reassigned)' : ''}`
          : `Cleared doctor assignment on Room ${room.number}`,
        targetType: 'OTRoom', targetId: room._id,
      });
    }

    res.json({ success:true, data:room });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.deleteRoom = async (req, res) => {
  try {
    await OTRoom.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Room deleted' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// ── SCHEDULES ─────────────────────────────────────────────────────────

exports.getSchedules = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const q = {};

    // STRICT: non-admin always sees only own schedule
    if (!isAdmin) {
      q.user = req.user.id;
    } else if (req.query.userId) {
      q.user = req.query.userId;
    }
    // Admin with no userId → sees ALL (for admin timetable page)

    if (req.query.role) q.role = req.query.role;
    if (req.query.date) {
      const d = new Date(req.query.date);
      q.date = { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(new Date(req.query.date).setHours(23,59,59,999)) };
    }
    if (req.query.week) {
      const start = new Date(req.query.week);
      const end   = new Date(start); end.setDate(end.getDate()+7);
      q.date = { $gte: start, $lt: end };
    }

    const schedules = await Schedule.find(q)
      .populate('user','name role department')
      .populate('room','name number type')
      .sort({ date:1 });
    res.json({ success:true, count:schedules.length, data:schedules });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.createSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.create(req.body);
    await schedule.populate('user','name role');
    const io = req.app.get('io');
    if (io) io.to(`user_${req.body.user}`).emit('schedule_assigned', { title:'New shift scheduled', date:req.body.date, shift:req.body.shift });
    res.status(201).json({ success:true, data:schedule });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.bulkSeedSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;
    await Schedule.insertMany(schedules);
    res.status(201).json({ success:true, count:schedules.length });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// POST /api/facility/schedules/generate-routine
// Auto-generates a randomized Monday–Sunday shift routine for every active
// staff member (everyone except admin/patient). Skips any day a user is
// already scheduled or on approved leave, unless `overwrite` is set —
// in which case existing non-leave schedule entries for that week are
// replaced. This is the "assign a random routine to all staff" feature.
exports.generateWeeklyRoutine = async (req, res) => {
  try {
    const User     = require('../models/User');
    const Leave    = require('../models/Leave');
    const { weekStart, overwrite } = req.body;

    // Resolve the Monday of the target week (default: current week)
    const base = weekStart ? new Date(weekStart) : new Date();
    const day = base.getDay(); // 0=Sun..6=Sat
    const monday = new Date(base);
    monday.setHours(0,0,0,0);
    monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    });
    const weekEnd = new Date(weekDates[6]); weekEnd.setHours(23,59,59,999);

    const staff = await User.find({ status: 'approved', role: { $nin: ['admin', 'patient'] } });
    if (!staff.length) return res.status(400).json({ success:false, error:'No staff found to assign routines to' });

    const SHIFTS = ['morning', 'afternoon', 'night'];
    const SHIFT_TIMES = { morning:['08:00','16:00'], afternoon:['14:00','22:00'], night:['22:00','06:00'], full:['07:00','19:00'] };
    const TASKS = {
      nurse: ['Ward rounds', 'Medication administration', 'Patient monitoring', 'ICU duty', 'OPD assistance'],
      pharmacist: ['Dispensing', 'Inventory check', 'Prescription review', 'Stock audit'],
      doctor: ['OPD consultations', 'Ward rounds', 'Surgery', 'On-call'],
      wardboy: ['Patient transport', 'Ward support', 'Equipment movement'],
      security: ['Main gate', 'Ward patrol', 'CCTV monitoring', 'Visitor checks'],
      receptionist: ['Front desk', 'Patient check-in', 'Appointment desk'],
      electrician: ['Maintenance rounds', 'Equipment checks'],
      plumber: ['Maintenance rounds', 'Plumbing checks'],
      it_technician: ['Systems support', 'Network monitoring'],
      equipment_tech: ['Equipment calibration', 'Maintenance checks'],
      biomedical: ['Device calibration', 'Equipment audits'],
      sweeper: ['Ward cleaning', 'Sanitation rounds'],
      otboy: ['OT setup', 'OT support'],
      ambulance_driver: ['Standby duty', 'Patient transport'],
      finance: ['Billing desk', 'Payroll processing', 'Accounts review'],
      lab_technician: ['Sample collection', 'Test processing', 'Report verification'],
    };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Find users already on approved leave during this week, per day
    const leaves = await Leave.find({
      status: 'approved',
      from: { $lte: weekEnd },
      to:   { $gte: monday },
    });
    const isOnLeave = (userId, date) => leaves.some(l =>
      l.user.toString() === userId.toString() && new Date(l.from) <= date && new Date(l.to) >= date
    );

    if (overwrite) {
      // Remove existing non-leave/non-completed entries for this week so
      // we don't end up with duplicate shifts on the same day.
      await Schedule.deleteMany({
        user: { $in: staff.map(s => s._id) },
        date: { $gte: monday, $lte: weekEnd },
        status: { $nin: ['completed', 'on-leave'] },
      });
    }

    // Find days that already have a schedule (to skip, when not overwriting)
    const existing = overwrite ? [] : await Schedule.find({
      user: { $in: staff.map(s => s._id) },
      date: { $gte: monday, $lte: weekEnd },
    });
    const hasExisting = (userId, date) => existing.some(s =>
      s.user.toString() === userId.toString() && new Date(s.date).toDateString() === date.toDateString()
    );

    const toInsert = [];
    for (const member of staff) {
      for (const date of weekDates) {
        if (isOnLeave(member._id, date)) continue;          // respect approved leave
        if (hasExisting(member._id, date)) continue;          // don't clobber existing
        const shift = pick(SHIFTS);
        const [startTime, endTime] = SHIFT_TIMES[shift];
        const taskPool = TASKS[member.role] || ['General duty'];
        toInsert.push({
          user: member._id,
          role: member.role,
          date,
          shift, startTime, endTime,
          department: member.department || '',
          task: pick(taskPool),
          status: 'scheduled',
        });
      }
    }

    if (toInsert.length) await Schedule.insertMany(toInsert);

    const io = req.app.get('io');
    if (io) io.emit('routine_generated', { weekStart: monday, count: toInsert.length });

    res.status(201).json({
      success: true,
      count: toInsert.length,
      staffCount: staff.length,
      weekStart: monday,
      weekEnd,
      message: `Generated ${toInsert.length} shift entries for ${staff.length} staff members`,
    });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success:false, error:'Schedule not found' });
    // Non-admin can only update their own schedule
    if (req.user.role !== 'admin' && schedule.user.toString() !== req.user.id) {
      return res.status(403).json({ success:false, error:'You can only update your own schedule' });
    }
    const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new:true }).populate('user','name role');
    res.json({ success:true, data:updated });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.deleteSchedule = async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Deleted' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// ── CHAT ──────────────────────────────────────────────────────────────

exports.getMessages = async (req, res) => {
  try {
    const { room = 'general', limit = 50 } = req.query;
    if (req.user.role === 'patient' && (!room.startsWith('dm_') || !room.includes(String(req.user.id)))) {
      return res.status(403).json({ success:false, error:'Patients can only view their direct conversation with their treating doctor' });
    }
    const msgs = await ChatMessage.find({ room })
      .populate('sender','name role avatar')
      .sort({ createdAt:-1 })
      .limit(parseInt(limit));
    res.json({ success:true, data:msgs.reverse() });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, room = 'general', receiver } = req.body;

    if (req.user.role === 'patient') {
      if (!receiver) {
        return res.status(403).json({ success:false, error:'Patients can only message their treating doctor directly, not post in shared channels' });
      }
      const treated = await Appointment.exists({ patient: req.user.id, doctor: receiver });
      if (!treated) {
        return res.status(403).json({ success:false, error:'You can only message a doctor you have consulted with' });
      }
      const doc = await User.findOne({ _id: receiver, role: 'doctor' }).select('_id');
      if (!doc) {
        return res.status(403).json({ success:false, error:'You can only message your treating doctor' });
      }
    }

    const msg = await ChatMessage.create({
      sender:req.user.id, senderName:req.user.name,
      senderRole:req.user.role, message, room,
      receiver: receiver || null,
    });
    await msg.populate('sender','name role avatar');
    const io = req.app.get('io');
    if (io) {
      io.to(room).emit('new_message', msg);
      if (receiver) io.to(`user_${receiver}`).emit('new_message', msg);
    }
    res.status(201).json({ success:true, data:msg });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.getChatUsers = async (req, res) => {
  try {
    const q = { status:'approved', _id:{ $ne:req.user.id } };
    // Restrict chat users by role
    const restrictedRoles = ['wardboy','sweeper','otboy','nurse','electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','lab_technician'];
    if (restrictedRoles.includes(req.user.role)) {
      q.role = { $in:['doctor','admin','nurse'] };
    }
    if (req.user.role === 'patient') {
      // Patients can only message doctors they've actually been treated by —
      // found from their appointment history — never admin/nurse/other staff,
      // and never a doctor they've never consulted.
      const doctorIds = await Appointment.distinct('doctor', { patient: req.user.id });
      q._id = { $in: doctorIds };
      q.role = 'doctor';
    }
    const users = await User.find(q).select('name role department isOnline lastSeen avatar').sort({ isOnline:-1, name:1 });
    res.json({ success:true, data:users });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// GET /api/facility/chat/unread — per-room unread counts for the current
// user, based on when they last opened each room (see ChatRead), so the
// sidebar/chat page can show badge counts without polling every message.
exports.getUnreadCounts = async (req, res) => {
  try {
    const reads = await ChatRead.find({ user: req.user.id });
    const readMap = {};
    reads.forEach(r => { readMap[r.room] = r.lastReadAt; });

    // Every room this user could plausibly see: channels (receiver: null,
    // visible to everyone) plus any DM room they've sent to or received in.
    const rooms = await ChatMessage.distinct('room', {
      $or: [{ sender: req.user.id }, { receiver: req.user.id }, { receiver: null }],
    });

    const counts = {};
    await Promise.all(rooms.map(async room => {
      const since = readMap[room] || new Date(0);
      const c = await ChatMessage.countDocuments({ room, sender: { $ne: req.user.id }, createdAt: { $gt: since } });
      if (c > 0) counts[room] = c;
    }));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ success:true, data: counts, total });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// POST /api/facility/chat/read — mark a room as read up to now for the current user
exports.markRoomRead = async (req, res) => {
  try {
    const { room } = req.body;
    if (!room) return res.status(400).json({ success:false, error:'room is required' });
    await ChatRead.findOneAndUpdate(
      { user: req.user.id, room },
      { lastReadAt: new Date() },
      { upsert: true }
    );
    res.json({ success:true });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};
