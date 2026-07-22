const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getTransfers, createTransfer, acceptTransfer, updateProgress } = require('../controllers/transferController');

router.use(protect);
router.get('/',  authorize('wardboy','doctor','nurse','receptionist','admin'), getTransfers);
router.post('/', authorize('doctor','nurse','receptionist','admin'), createTransfer);
router.put('/:id/accept',   authorize('wardboy','admin'), acceptTransfer);
router.put('/:id/progress', authorize('wardboy','admin'), updateProgress);

module.exports = router;
