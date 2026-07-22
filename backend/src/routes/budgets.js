const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getAll, upsert, remove, getSummary } = require('../controllers/budgetController');

router.use(protect, authorize('admin', 'finance'));

router.get('/summary', getSummary);
router.get('/',         getAll);
router.post('/',        upsert);
router.delete('/:id',   remove);

module.exports = router;
