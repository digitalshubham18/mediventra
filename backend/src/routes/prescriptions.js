const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { create, getForPatient, getByDoctor, getOne } = require('../controllers/prescriptionController');

router.use(protect);
router.post('/',        authorize('doctor'), create);
router.get('/mine',     authorize('patient'), getForPatient);
router.get('/issued',   authorize('doctor'), getByDoctor);
router.get('/:id',      getOne);

module.exports = router;
