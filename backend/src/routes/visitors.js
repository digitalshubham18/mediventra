const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { checkIn, getAll, checkOut } = require('../controllers/visitorController');

router.use(protect);

router.get('/', authorize('security', 'admin', 'receptionist'), getAll);
router.post('/', authorize('security', 'admin', 'receptionist'), checkIn);
router.put('/:id/checkout', authorize('security', 'admin', 'receptionist'), checkOut);

module.exports = router;
