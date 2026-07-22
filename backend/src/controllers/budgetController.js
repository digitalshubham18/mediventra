const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const Salary = require('../models/Salary');

// GET /api/budgets?month=&year=
exports.getAll = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, error: 'month and year are required' });
    const budgets = await Budget.find({ month: Number(month), year: Number(year) }).populate('createdBy', 'name').sort({ category: 1 });
    res.json({ success: true, data: budgets });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// POST /api/budgets — create or update the allocation for a category/month/year
exports.upsert = async (req, res) => {
  try {
    const { category, month, year, allocatedAmount, notes } = req.body;
    if (!category || !month || !year || allocatedAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Category, month, year, and allocated amount are required' });
    }
    if (Number(allocatedAmount) < 0) return res.status(400).json({ success: false, error: 'Allocated amount can\u2019t be negative' });
    const budget = await Budget.findOneAndUpdate(
      { category, month: Number(month), year: Number(year) },
      { $set: { allocatedAmount: Number(allocatedAmount), notes: notes || '', createdBy: req.user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: budget });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// DELETE /api/budgets/:id
exports.remove = async (req, res) => {
  try {
    const budget = await Budget.findByIdAndDelete(req.params.id);
    if (!budget) return res.status(404).json({ success: false, error: 'Budget not found' });
    res.json({ success: true, message: 'Budget removed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// GET /api/budgets/summary?month=&year= — allocated vs actual spend per category
// "payroll" pulls its actual from credited Salary records for the period;
// every other category pulls from Expense records tagged with it.
exports.getSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, error: 'month and year are required' });
    const m = Number(month), y = Number(year);

    const [budgets, expenses, payrollAgg] = await Promise.all([
      Budget.find({ month: m, year: y }),
      Expense.find({ expenseDate: { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) } }),
      Salary.aggregate([
        { $match: { month: m, year: y, status: 'credited' } },
        { $group: { _id: null, total: { $sum: '$netPay' } } },
      ]),
    ]);

    const payrollActual = payrollAgg[0]?.total || 0;
    const expenseByCategory = {};
    expenses.forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount; });

    const categories = ['payroll','utilities','maintenance','supplies','equipment','rent','marketing','administrative','pharmacy_stock','other'];
    const summary = categories.map(category => {
      const budget = budgets.find(b => b.category === category);
      const actual = category === 'payroll' ? payrollActual : (expenseByCategory[category] || 0);
      const allocated = budget?.allocatedAmount || 0;
      return {
        category,
        budgetId: budget?._id || null,
        allocatedAmount: allocated,
        actualSpent: actual,
        remaining: allocated - actual,
        percentUsed: allocated > 0 ? Math.round((actual / allocated) * 100) : (actual > 0 ? 100 : 0),
        overBudget: allocated > 0 && actual > allocated,
      };
    }).filter(s => s.allocatedAmount > 0 || s.actualSpent > 0);

    res.json({ success: true, data: summary });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
