const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  scheduleSurgery, getAll, getToday, getOne,
  updateChecklistItem, moveToPreOp, startSurgery, completeSurgery, cancelSurgery,
} = require('../controllers/surgeryController');

router.use(protect);

router.get('/today', getToday);
router.get('/', getAll);
router.post('/', authorize('doctor', 'admin'), scheduleSurgery);
router.get('/:id', getOne);
router.put('/:id/checklist', authorize('doctor', 'nurse', 'admin'), updateChecklistItem);
router.put('/:id/move-to-pre-op', authorize('doctor', 'nurse', 'admin'), moveToPreOp);
router.put('/:id/start', authorize('doctor', 'admin'), startSurgery);
router.put('/:id/complete', authorize('doctor', 'admin'), completeSurgery);
router.put('/:id/cancel', authorize('doctor', 'admin'), cancelSurgery);

module.exports = router;
