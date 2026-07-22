const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createOrder, getOrders, getOrder, scheduleOrder, startOrder, completeOrder, submitReport, cancelOrder, deleteOrder,
} = require('../controllers/radiologyController');

router.use(protect);
router.use((req, res, next) => { req.uploadFolder = 'radiology'; next(); });

router.get('/orders', getOrders);
router.post('/orders', authorize('doctor', 'admin'), createOrder);
router.get('/orders/:id', getOrder);
router.put('/orders/:id/schedule', authorize('radiology_tech', 'admin'), scheduleOrder);
router.put('/orders/:id/start', authorize('radiology_tech', 'admin'), startOrder);
router.put('/orders/:id/complete', authorize('radiology_tech', 'admin'), upload.array('images', 10), completeOrder);
router.put('/orders/:id/report', authorize('doctor', 'admin'), submitReport);
router.put('/orders/:id/cancel', authorize('doctor', 'admin'), cancelOrder);
router.delete('/orders/:id', authorize('admin'), deleteOrder);

module.exports = router;
