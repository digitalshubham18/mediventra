const router = require('express').Router();
const { getPublicDoctors, getPublicStats, getPublicHospitalInfo } = require('../controllers/publicController');

// No `protect` middleware — these power the pre-login marketing homepage.
router.get('/doctors', getPublicDoctors);
router.get('/stats', getPublicStats);
router.get('/hospital-info', getPublicHospitalInfo);

module.exports = router;
