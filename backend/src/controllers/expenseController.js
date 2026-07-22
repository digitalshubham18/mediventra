const Expense = require('../models/Expense');
const { buildFileUrl } = require('../middleware/upload');

// GET /api/expenses?month=&year=&category=
exports.getAll = async (req, res) => {
  try {
    const { month, year, category } = req.query;
    const q = {};
    if (category) q.category = category;
    if (month && year) {
      const from = new Date(Number(year), Number(month) - 1, 1);
      const to = new Date(Number(year), Number(month), 1);
      q.expenseDate = { $gte: from, $lt: to };
    } else if (year) {
      q.expenseDate = { $gte: new Date(Number(year), 0, 1), $lt: new Date(Number(year) + 1, 0, 1) };
    }
    const expenses = await Expense.find(q).populate('addedBy', 'name').sort({ expenseDate: -1 });
    res.json({ success: true, count: expenses.length, data: expenses });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/expenses
exports.create = async (req, res) => {
  try {
    const { category, description, amount, vendor, department, expenseDate, paymentMode, receiptNumber, chequeNumber, chequeBankName, chequeDate, notes } = req.body;
    if (!category || !description?.trim() || !amount) {
      return res.status(400).json({ success: false, error: 'Category, description, and amount are required' });
    }
    if (Number(amount) <= 0) return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
    if (paymentMode === 'cash' && !receiptNumber?.trim()) return res.status(400).json({ success: false, error: 'Receipt number is required for a cash expense' });
    if (paymentMode === 'cheque' && (!chequeNumber?.trim() || !chequeBankName?.trim() || !chequeDate)) {
      return res.status(400).json({ success: false, error: 'Cheque number, bank name, and cheque date are required for a cheque expense' });
    }
    const attachmentUrl = req.file ? buildFileUrl(req.file, 'expenses') : '';
    const expense = await Expense.create({
      category, description: description.trim(), amount: Number(amount), vendor: vendor?.trim() || '',
      department: department?.trim() || '', expenseDate: expenseDate || new Date(),
      paymentMode: paymentMode || 'cash', receiptNumber: receiptNumber?.trim() || '',
      chequeNumber: chequeNumber?.trim() || '', chequeBankName: chequeBankName?.trim() || '',
      chequeDate: chequeDate || null, notes: notes?.trim() || '', attachmentUrl,
      addedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// PUT /api/expenses/:id
exports.update = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    const fields = ['category','description','amount','vendor','department','expenseDate','paymentMode','receiptNumber','chequeNumber','chequeBankName','chequeDate','notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) expense[f] = req.body[f]; });
    if (req.file) expense.attachmentUrl = buildFileUrl(req.file, 'expenses');
    await expense.save();
    res.json({ success: true, data: expense });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/expenses/:id
exports.remove = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
