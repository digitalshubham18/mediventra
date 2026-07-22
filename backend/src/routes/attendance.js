const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { checkIn, checkOut, getMine, getAll, manualOverride, enrollFace, getFaceStatus, deleteFaceProfile, submitLateRequest, getLateRequests, decideLateRequest } = require('../controllers/attendanceController');

router.use(protect);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/mine', getMine);
router.get('/', authorize('admin', 'finance'), getAll);
router.put('/:id/mark', authorize('admin', 'finance'), manualOverride);

router.post('/face/enroll', enrollFace);
router.get('/face/status', getFaceStatus);
router.delete('/face', deleteFaceProfile);

router.post('/late-request', submitLateRequest);
router.get('/late-requests', getLateRequests);
router.put('/late-requests/:id/decide', authorize('admin', 'finance'), decideLateRequest);

module.exports = router;
