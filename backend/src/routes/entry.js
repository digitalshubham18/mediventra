const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMyEntries, getPendingEntries, verifyEntry, assignRoom,
  getWardboyQueue, acknowledgeEntry, geofenceCheckIn, deleteEntry,
} = require('../controllers/entryController');

router.use(protect);

// Patient — view their own entry code(s), or auto check-in via GPS
router.get('/mine', getMyEntries);
router.post('/geofence-checkin', authorize('patient'), geofenceCheckIn);

// Receptionist — check-in queue + OTP verification + room assignment
router.get('/pending', authorize('receptionist', 'admin'), getPendingEntries);
router.post('/verify', authorize('receptionist', 'admin'), verifyEntry);
router.put('/:id/assign-room', authorize('receptionist', 'admin'), assignRoom);
router.delete('/:id', authorize('receptionist', 'admin'), deleteEntry);

// Wardboy — queue of patients to escort
router.get('/wardboy-queue', authorize('wardboy', 'admin'), getWardboyQueue);
router.put('/:id/acknowledge', authorize('wardboy', 'admin'), acknowledgeEntry);

module.exports = router;
