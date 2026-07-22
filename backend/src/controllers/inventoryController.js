const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const Indent = require('../models/Indent');
const User = require('../models/User');
const { notify } = require('../utils/notify');

// ── ITEM MASTER ─────────────────────────────────────────────────────────

// POST /api/inventory/items
exports.createItem = async (req, res) => {
  try {
    const { name, category, unit, currentStock, minStock, unitCost, supplier, storeLocation, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Item name is required' });
    const item = await InventoryItem.create({
      name: name.trim(), category, unit, currentStock: Number(currentStock) || 0, minStock: Number(minStock) || 10,
      unitCost: Number(unitCost) || 0, supplier: supplier?.trim() || '', storeLocation: storeLocation?.trim() || 'Central Store',
      notes: notes?.trim() || '', createdBy: req.user.id,
    });
    if (item.currentStock > 0) {
      await StockTransaction.create({ item: item._id, type: 'in', quantity: item.currentStock, reason: 'Initial stock', balanceAfter: item.currentStock, performedBy: req.user.id });
    }
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/inventory/items?category=&lowStock=1&search=
exports.getItems = async (req, res) => {
  try {
    const q = { isActive: true };
    if (req.query.category) q.category = req.query.category;
    if (req.query.search) q.name = { $regex: req.query.search, $options: 'i' };
    let items = await InventoryItem.find(q).sort({ name: 1 });
    if (req.query.lowStock === '1') items = items.filter(i => i.currentStock <= i.minStock);
    res.json({ success: true, count: items.length, data: items });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/items/:id
exports.updateItem = async (req, res) => {
  try {
    const allowed = ['name','category','unit','minStock','unitCost','supplier','storeLocation','notes','isActive'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/items/:id/stock-in — record new stock received
exports.stockIn = async (req, res) => {
  try {
    const { quantity, reason } = req.body;
    if (!quantity || Number(quantity) <= 0) return res.status(400).json({ success: false, error: 'Enter a valid quantity' });
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    item.currentStock += Number(quantity);
    await item.save();
    await StockTransaction.create({ item: item._id, type: 'in', quantity: Number(quantity), reason: reason?.trim() || 'Stock received', balanceAfter: item.currentStock, performedBy: req.user.id });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/items/:id/adjust — correction / wastage / expiry write-off
exports.adjustStock = async (req, res) => {
  try {
    const { newQuantity, reason } = req.body;
    if (newQuantity === undefined || Number(newQuantity) < 0) return res.status(400).json({ success: false, error: 'Enter a valid quantity' });
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    const delta = Number(newQuantity) - item.currentStock;
    item.currentStock = Number(newQuantity);
    await item.save();
    await StockTransaction.create({ item: item._id, type: 'adjustment', quantity: Math.abs(delta), reason: reason?.trim() || (delta<0 ? 'Stock write-off' : 'Stock correction'), balanceAfter: item.currentStock, performedBy: req.user.id });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/inventory/items/:id/ledger — this item's full transaction history
exports.getLedger = async (req, res) => {
  try {
    const txns = await StockTransaction.find({ item: req.params.id }).populate('performedBy', 'name role').populate('indent', 'indentNumber department').sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: txns });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── INDENTS (department requisitions) ──────────────────────────────────

// POST /api/inventory/indents
exports.createIndent = async (req, res) => {
  try {
    const { department, items, priority, neededBy, reason } = req.body;
    if (!department?.trim()) return res.status(400).json({ success: false, error: 'Department is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, error: 'Add at least one item to the indent' });

    for (const it of items) {
      if (!it.item || !it.requestedQuantity || Number(it.requestedQuantity) <= 0) {
        return res.status(400).json({ success: false, error: 'Every item needs a valid item and quantity' });
      }
    }

    const indent = await Indent.create({
      department: department.trim(), requestedBy: req.user.id,
      items: items.map(i => ({ item: i.item, requestedQuantity: Number(i.requestedQuantity) })),
      priority: priority || 'normal', neededBy: neededBy || null, reason: reason?.trim() || '',
    });
    await indent.populate('items.item', 'name unit currentStock');
    await indent.populate('requestedBy', 'name role');

    const storeManagers = await User.find({ role: { $in: ['admin','finance'] }, status: 'approved' }).select('_id');
    for (const m of storeManagers) {
      await notify(req, m._id, {
        type: 'indent_created', title: '📦 New store indent',
        message: `${indent.department} requested ${indent.items.length} item(s)${indent.priority==='urgent'?' — URGENT':''}`,
        link: '/inventory', icon: '📦',
      });
    }

    const io = req.app.get('io');
    if (io) io.emit('indent_created', { indentId: indent._id, department: indent.department });

    res.status(201).json({ success: true, data: indent });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// GET /api/inventory/indents?status=&mine=1
exports.getIndents = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.mine === '1' || !['admin','finance'].includes(req.user.role)) q.requestedBy = req.user.id;
    const indents = await Indent.find(q).populate('items.item', 'name unit currentStock').populate('requestedBy', 'name role').populate('approvedBy', 'name').populate('fulfilledBy', 'name').sort({ createdAt: -1 });
    res.json({ success: true, count: indents.length, data: indents });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/indents/:id/approve — full or partial approval, or rejection
exports.reviewIndent = async (req, res) => {
  try {
    const { decision, approvedQuantities, rejectionReason } = req.body; // decision: 'approve' | 'reject'
    const indent = await Indent.findById(req.params.id).populate('requestedBy', 'name');
    if (!indent) return res.status(404).json({ success: false, error: 'Indent not found' });
    if (indent.status !== 'pending') return res.status(400).json({ success: false, error: `Cannot review an indent that is already "${indent.status}"` });

    if (decision === 'reject') {
      indent.status = 'rejected';
      indent.rejectionReason = rejectionReason?.trim() || '';
    } else {
      let anyReduced = false;
      indent.items = indent.items.map(it => {
        const approvedQty = approvedQuantities?.[String(it.item)] !== undefined ? Number(approvedQuantities[String(it.item)]) : it.requestedQuantity;
        if (approvedQty < it.requestedQuantity) anyReduced = true;
        return { ...it.toObject(), approvedQuantity: approvedQty };
      });
      indent.status = anyReduced ? 'partially_approved' : 'approved';
      indent.approvedBy = req.user.id;
      indent.approvedAt = new Date();
    }
    await indent.save();
    await indent.populate('items.item', 'name unit currentStock');

    await notify(req, indent.requestedBy._id, {
      type: 'indent_reviewed', title: decision === 'reject' ? '❌ Indent rejected' : '✅ Indent approved',
      message: `${indent.indentNumber} — ${decision === 'reject' ? (indent.rejectionReason || 'No reason given') : indent.status}`,
      link: '/inventory', icon: decision === 'reject' ? '❌' : '✅',
    });

    res.json({ success: true, data: indent });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/indents/:id/fulfill — physically dispatch stock, deducting from inventory
exports.fulfillIndent = async (req, res) => {
  try {
    const indent = await Indent.findById(req.params.id).populate('items.item').populate('requestedBy', 'name');
    if (!indent) return res.status(404).json({ success: false, error: 'Indent not found' });
    if (!['approved', 'partially_approved'].includes(indent.status)) {
      return res.status(400).json({ success: false, error: 'Only approved indents can be fulfilled' });
    }

    // Verify stock availability for everything before deducting anything —
    // an indent shouldn't be half-fulfilled due to a mid-loop stock-out.
    // Safe to check concurrently since this is read-only.
    const shortfalls = (await Promise.all(indent.items.map(async (it) => {
      const qty = it.approvedQuantity ?? it.requestedQuantity;
      return it.item.currentStock < qty ? { name: it.item.name, have: it.item.currentStock, need: qty } : null;
    }))).filter(Boolean);
    if (shortfalls.length > 0) {
      const s = shortfalls[0];
      return res.status(400).json({ success: false, error: `Not enough stock for ${s.name} (have ${s.have}, need ${s.need}). Restock first or reduce the approved quantity.` });
    }

    // Deduction stays sequential (not parallelized) on purpose: if an indent
    // ever lists the same item on two lines, concurrent reads-then-writes to
    // the same InventoryItem document would race and one deduction could be
    // silently lost. This isn't a high-frequency operation, so correctness
    // wins over the small speed gain here.
    for (const it of indent.items) {
      const qty = it.approvedQuantity ?? it.requestedQuantity;
      const itemDoc = await it.item.constructor.findById(it.item._id);
      itemDoc.currentStock -= qty;
      await itemDoc.save();
      await StockTransaction.create({ item: itemDoc._id, type: 'out', quantity: qty, reason: `Indent ${indent.indentNumber} — ${indent.department}`, indent: indent._id, balanceAfter: itemDoc.currentStock, performedBy: req.user.id });
    }

    indent.status = 'fulfilled';
    indent.fulfilledBy = req.user.id;
    indent.fulfilledAt = new Date();
    await indent.save();

    await notify(req, indent.requestedBy._id, {
      type: 'indent_fulfilled', title: '📦 Indent fulfilled',
      message: `${indent.indentNumber} has been dispatched to ${indent.department}`,
      link: '/inventory', icon: '📦',
    });

    res.json({ success: true, data: indent });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// PUT /api/inventory/indents/:id/cancel — requester cancels their own pending indent
exports.cancelIndent = async (req, res) => {
  try {
    const indent = await Indent.findById(req.params.id);
    if (!indent) return res.status(404).json({ success: false, error: 'Indent not found' });
    if (String(indent.requestedBy) !== String(req.user.id) && !['admin','finance'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (['fulfilled', 'cancelled'].includes(indent.status)) return res.status(400).json({ success: false, error: `Cannot cancel an indent that is already ${indent.status}` });
    indent.status = 'cancelled';
    await indent.save();
    res.json({ success: true, data: indent });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
