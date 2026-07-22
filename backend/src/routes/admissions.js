const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { admitPatient, getAll, getMine, getBillPreview, dischargePatient } = require('../controllers/admissionController');

router.use(protect);
router.get('/mine',              authorize('patient'), getMine);
router.get('/',                  authorize('admin','doctor','nurse','receptionist'), getAll);
router.post('/',                 authorize('admin','doctor','nurse','receptionist'), admitPatient);
router.get('/:id/bill-preview',  authorize('admin','doctor','nurse','receptionist'), getBillPreview);
router.put('/:id/discharge',     authorize('admin','doctor','nurse','receptionist'), dischargePatient);

module.exports = router;
