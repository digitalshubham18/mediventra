const Announcement = require('../models/Announcement');

exports.getAll = async (req, res) => {
  try {
    const q = { $or: [{ expiresAt:{ $gt:new Date() } }, { expiresAt:null }] };
    if (req.user.role !== 'admin') {
      q.$or = [{ targetRoles:{ $size:0 } }, { targetRoles:req.user.role }];
    }
    const announcements = await Announcement.find(q)
      .populate('createdBy','name role')
      .populate('pinnedBy','name')
      .sort({ pinned:-1, createdAt:-1 });
    res.json({ success:true, count:announcements.length, data:announcements });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const body = { ...req.body };
    // Security can broadcast, but only ever as an emergency notice — full
    // announcement authoring (general/holiday/event/etc.) stays admin-only.
    if (req.user.role === 'security') { body.type = 'emergency'; body.priority = 'urgent'; }
    const ann = await Announcement.create({ ...body, createdBy:req.user.id });
    await ann.populate('createdBy','name role');
    const io = req.app.get('io');
    if (io) io.emit('new_announcement', { title:ann.title, type:ann.type, pinned:ann.pinned, priority:ann.priority });
    res.status(201).json({ success:true, data:ann });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.pin = async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndUpdate(req.params.id,
      { pinned:true, pinnedAt:new Date(), pinnedBy:req.user.id, type:'pinned' },
      { new:true }
    ).populate('createdBy','name');
    if (!ann) return res.status(404).json({ success:false, error:'Not found' });
    const io = req.app.get('io');
    if (io) io.emit('announcement_pinned', { title:ann.title, pinnedBy:req.user.name });
    res.json({ success:true, data:ann });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.unpin = async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndUpdate(req.params.id,
      { pinned:false, type:'general' }, { new:true }
    );
    res.json({ success:true, data:ann });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!ann) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:ann });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Deleted' });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};

exports.markRead = async (req, res) => {
  try {
    await Announcement.findByIdAndUpdate(req.params.id, { $addToSet:{ readBy:req.user.id } });
    res.json({ success:true });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
};
