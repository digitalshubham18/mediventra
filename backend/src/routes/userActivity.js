const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getOverview, getUserSessions, getUserActivity, getMyToday, getMySessions, getMyActivity } = require('../controllers/userActivityController');

// Any logged-in user — their own activity, never someone else's
router.get('/me/today',     protect, getMyToday);
router.get('/me/sessions',  protect, getMySessions);
router.get('/me/activity',  protect, getMyActivity);

router.use(protect, authorize('admin'));
router.get('/overview',            getOverview);
router.get('/:userId/sessions',    getUserSessions);
router.get('/:userId/activity',    getUserActivity);

module.exports = router;
