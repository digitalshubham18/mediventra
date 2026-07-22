const express = require('express');
const router = express.Router();
const { getAlerts, createAlert, acknowledgeAlert, resolveAlert } = require('../controllers/resourceControllers');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getAlerts);
router.post('/', createAlert);
router.put('/:id/acknowledge', authorize('admin', 'doctor', 'nurse', 'security'), acknowledgeAlert);
router.put('/:id/resolve', authorize('admin', 'doctor', 'nurse', 'security'), resolveAlert);

module.exports = router;