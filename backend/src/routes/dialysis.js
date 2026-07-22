const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  scheduleSession, getSessions, getToday, startSession, completeSession, repeatSession, cancelSession,
} = require('../controllers/dialysisController');

router.use(protect);

router.get('/sessions/today', getToday);
router.get('/sessions', getSessions);
router.post('/sessions', authorize('doctor', 'nurse', 'dialysis_tech', 'admin'), scheduleSession);
router.put('/sessions/:id/start', authorize('dialysis_tech', 'nurse', 'admin'), startSession);
router.put('/sessions/:id/complete', authorize('dialysis_tech', 'nurse', 'admin'), completeSession);
router.post('/sessions/:id/repeat', authorize('doctor', 'nurse', 'dialysis_tech', 'admin'), repeatSession);
router.put('/sessions/:id/cancel', authorize('doctor', 'nurse', 'dialysis_tech', 'admin'), cancelSession);

module.exports = router;
