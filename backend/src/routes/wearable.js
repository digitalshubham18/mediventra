const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMine, addEntry, importCsv, getFitbitAuthUrl, fitbitCallback, syncFitbit, getGoogleFitAuthUrl, googleFitCallback, syncGoogleFit, getForPatient, recordForPatient } = require('../controllers/wearableController');

// Fitbit/Google both redirect the browser here directly — no auth header
// available, hence these routes sit outside the protect() wall and
// instead use the state param (the user id) set when the auth URL was
// generated.
router.get('/fitbit/callback', fitbitCallback);
router.get('/google-fit/callback', googleFitCallback);

// Nurse/doctor/admin — record or review bedside vitals for a specific patient
router.get('/patient/:patientId',  protect, authorize('nurse','doctor','admin'), getForPatient);
router.post('/patient/:patientId', protect, authorize('nurse','doctor','admin'), recordForPatient);

router.use(protect, authorize('patient'));
router.get('/', getMine);
router.post('/', addEntry);
router.post('/import', importCsv);
router.get('/fitbit/connect', getFitbitAuthUrl);
router.post('/fitbit/sync', syncFitbit);
router.get('/google-fit/connect', getGoogleFitAuthUrl);
router.post('/google-fit/sync', syncGoogleFit);

module.exports = router;
