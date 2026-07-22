const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAll, getMine, getDueForService, create, update, checkout, checkin, markServiced, remove } = require('../controllers/assetController');

router.use(protect);
router.get('/', getAll); // any staff can view where equipment is
router.get('/mine', getMine);
router.get('/due-service', getDueForService);
router.post('/', authorize('admin'), create);
router.put('/:id', update); // any staff can update location (they're the ones moving it)
router.put('/:id/checkout', checkout);
router.put('/:id/checkin', checkin);
router.put('/:id/service', markServiced);
router.delete('/:id', authorize('admin'), remove);

module.exports = router;
