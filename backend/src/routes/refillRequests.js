const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { create, getMine, getForReview, review } = require('../controllers/refillController');

router.use(protect);
router.post('/',            authorize('patient'), create);
router.get('/mine',          authorize('patient'), getMine);
router.get('/for-review',    authorize('doctor','pharmacist','admin'), getForReview);
router.put('/:id/review',    authorize('doctor','pharmacist','admin'), review);

module.exports = router;
