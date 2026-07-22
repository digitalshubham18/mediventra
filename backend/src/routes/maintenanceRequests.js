const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { create, getAll, claim, resolve } = require('../controllers/maintenanceRequestController');

const TRADES = ['electrician', 'plumber', 'equipment_tech', 'biomedical', 'it_technician', 'admin'];

router.use(protect);
router.post('/',            create); // any authenticated staff member can report an issue
router.get('/',              authorize(...TRADES), getAll);
router.put('/:id/claim',     authorize(...TRADES), claim);
router.put('/:id/resolve',   authorize(...TRADES), resolve);

module.exports = router;
