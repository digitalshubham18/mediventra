const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createInvoice, getAll, getOne, recordPayment, cancelInvoice, gstSummary,
  createPackage, getPackages, updatePackage, deletePackage,
} = require('../controllers/invoiceController');

router.use(protect);

router.get('/packages', getPackages);
router.post('/packages', authorize('admin', 'finance'), createPackage);
router.put('/packages/:id', authorize('admin', 'finance'), updatePackage);
router.delete('/packages/:id', authorize('admin', 'finance'), deletePackage);

router.get('/gst-summary', authorize('admin', 'finance'), gstSummary);

router.get('/', getAll);
router.post('/', authorize('admin', 'finance', 'receptionist'), createInvoice);
router.get('/:id', getOne);
router.put('/:id/pay', authorize('admin', 'finance', 'receptionist'), recordPayment);
router.put('/:id/cancel', authorize('admin', 'finance'), cancelInvoice);

module.exports = router;
