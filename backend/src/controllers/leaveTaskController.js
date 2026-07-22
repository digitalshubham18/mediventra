const Leave = require('../models/Leave');
const Task  = require('../models/Task');
const { notify } = require('../utils/notify');

// ── LEAVES ────────────────────────────────────────────────────────────

exports.getLeaves = async (req, res) => {
  try {
    const q = {};
    if (req.user.role !== 'admin') q.user = req.user.id;
    if (req.query.userId) q.user   = req.query.userId;
    if (req.query.status) q.status = req.query.status;
    const leaves = await Leave.find(q)
      .populate('user','name role department avatar')
      .populate('reviewedBy','name')
      .sort({ createdAt:-1 });
    res.json({ success:true, count:leaves.length, data:leaves });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.applyLeave = async (req, res) => {
  try {
    const { type, from, to, reason } = req.body;
    if (!type||!from||!to||!reason) return res.status(400).json({ success:false, error:'All fields required' });
    const fromD = new Date(from), toD = new Date(to);
    if (fromD > toD) return res.status(400).json({ success:false, error:'End date must be after start date' });
    const days = Math.ceil((toD - fromD) / (1000*60*60*24)) + 1;
    const leave = await Leave.create({ user:req.user.id, type, from:fromD, to:toD, days, reason });
    await leave.populate('user','name role');
    const io = req.app.get('io');
    if (io) io.emit('leave_applied', { userName:req.user.name, type, days, leaveId:leave._id });
    res.status(201).json({ success:true, data:leave });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.reviewLeave = async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    const leave = await Leave.findByIdAndUpdate(req.params.id, {
      status, reviewNote: reviewNote||'', reviewedBy:req.user.id,
      reviewedAt:new Date(), isOnLeave: status==='approved',
    }, { new:true }).populate('user','name role department');
    if (!leave) return res.status(404).json({ success:false, error:'Leave not found' });
    const io = req.app.get('io');
    if (io) io.emit('leave_reviewed', { leaveId:leave._id, userName:leave.user.name, userRole:leave.user.role, status, from:leave.from, to:leave.to, type:leave.type });
    await notify(req, leave.user._id, { type:'leave_reviewed', title: status==='approved' ? '✅ Leave approved' : '❌ Leave rejected', message:`Your ${leave.type} leave request (${new Date(leave.from).toLocaleDateString()} – ${new Date(leave.to).toLocaleDateString()}) was ${status}${reviewNote?`: ${reviewNote}`:''}`, link:'/leave', icon: status==='approved'?'✅':'❌' });
    res.json({ success:true, data:leave });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success:false, error:'Not found' });
    if (leave.user.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success:false, error:'Unauthorized' });
    leave.status = 'rejected'; await leave.save();
    res.json({ success:true, data:leave });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.getTodayLeaves = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const leaves = await Leave.find({ status:'approved', from:{ $lte:tomorrow }, to:{ $gte:today } })
      .populate('user','name role department avatar');
    res.json({ success:true, data:leaves });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

// ── TASKS ─────────────────────────────────────────────────────────────

exports.getTasks = async (req, res) => {
  try {
    const q = {};
    // Non-admin ALWAYS sees only their own assigned tasks
    if (req.user.role !== 'admin') {
      q.assignedTo = req.user.id;
    } else {
      if (req.query.assignedTo) q.assignedTo = req.query.assignedTo;
    }
    if (req.query.status)   q.status   = req.query.status;
    if (req.query.priority) q.priority = req.query.priority;
    const tasks = await Task.find(q)
      .populate('assignedTo','name role')
      .populate('assignedBy','name role')
      .populate('room','name number')
      .sort({ createdAt:-1 });
    res.json({ success:true, count:tasks.length, data:tasks });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, assignedBy:req.user.id });
    await task.populate('assignedTo','name role');
    await task.populate('assignedBy','name role');
    const io = req.app.get('io');
    if (io) io.to(`user_${task.assignedTo._id}`).emit('task_assigned', { taskId:task._id, title:task.title, assignedBy:req.user.name, priority:task.priority });
    await notify(req, task.assignedTo._id, { type:'task_assigned', title:'New task assigned', message:`${req.user.name} assigned you: ${task.title}`, link:'/tasks', icon:'📋' });
    res.status(201).json({ success:true, data:task });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.updateTask = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.status === 'completed') update.completedAt = new Date();
    const task = await Task.findByIdAndUpdate(req.params.id, update, { new:true })
      .populate('assignedTo','name role').populate('assignedBy','name role');
    if (!task) return res.status(404).json({ success:false, error:'Task not found' });
    res.json({ success:true, data:task });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Task deleted' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};
