const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createSchedule, getPatientSchedules, discontinueSchedule, getTodayDue, logDose,
} = require('../controllers/medicationController');

router.use(protect);
router.use(authorize('doctor','nurse','admin'));

router.post('/schedules',                createSchedule);
router.get('/schedules/:patientId',      getPatientSchedules);
router.put('/schedules/:id/discontinue', discontinueSchedule);
router.get('/today',                     getTodayDue);
router.post('/log',                      logDose);

module.exports = router;
