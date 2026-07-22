const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getTrips, createTrip, updateTrip, requestAmbulance, getMyRequests, acceptRequest, updateProgress } = require('../controllers/ambulanceTripController');

router.use(protect);
router.get('/',     getTrips);
router.post('/',    createTrip);
router.put('/:id',  updateTrip);

// Patient-facing request flow
router.post('/request',       authorize('patient'), requestAmbulance);
router.get('/mine',           authorize('patient'), getMyRequests);
router.put('/:id/accept',     authorize('ambulance_driver','admin'), acceptRequest);
router.put('/:id/progress',   authorize('ambulance_driver','admin'), updateProgress);

module.exports = router;
