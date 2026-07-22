const express = require('express');
const router = express.Router();
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/resourceControllers');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/', getOrders);
router.post('/', (req, res, next) => { req.uploadFolder = 'prescriptions'; next(); }, upload.single('prescription'), createOrder);
router.put('/:id/status', authorize('admin', 'pharmacist'), updateOrderStatus);

module.exports = router;