const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getQueue, createToken, updateTokenStatus, getMine, getPublicBoard } = require('../controllers/queueController');

// Public kiosk/waiting-room display — no auth, read-only "now serving" board
router.get('/public/board', getPublicBoard);

router.use(protect);
router.get('/',  authorize('receptionist','admin','doctor','nurse'), getQueue);
router.get('/mine', authorize('patient'), getMine);
router.post('/', authorize('receptionist','admin','patient'), createToken);
router.put('/:id/status', authorize('receptionist','admin','doctor','nurse'), updateTokenStatus);

module.exports = router;
