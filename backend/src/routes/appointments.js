// const express = require('express');
// const router = express.Router();
// const {
//   getAppointments, createAppointment, updateAppointment,
//   deleteAppointment, getAvailableSlots
// } = require('../controllers/appointmentController');
// const { protect, authorize } = require('../middleware/auth');

// router.use(protect);
// router.get('/slots/:doctorId/:date', getAvailableSlots);
// router.get('/', getAppointments);
// router.post('/', createAppointment);
// router.put('/:id', updateAppointment);
// router.delete('/:id', authorize('admin'), deleteAppointment);

// module.exports = router;

const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getAppointments, createAppointment, updateAppointment, deleteAppointment, getAvailableSlots, cancelAppointment, getVideoRoom, startVideoCall, endVideoCall, decideAdmission, getAdmissionQueue } = require('../controllers/appointmentController');
const { join: joinWaitlist, getMine: getMyWaitlist, leave: leaveWaitlist } = require('../controllers/waitlistController');
router.use(protect);
router.get('/slots/:doctorId/:date', getAvailableSlots);
router.post('/waitlist',      authorize('patient'), joinWaitlist);
router.get('/waitlist/mine',  authorize('patient'), getMyWaitlist);
router.delete('/waitlist/:id',authorize('patient'), leaveWaitlist);
router.get('/admission-queue', authorize('receptionist','admin'), getAdmissionQueue);
router.put('/:id/admission-decision', authorize('doctor','admin'), decideAdmission);
router.get('/',      getAppointments);
router.post('/',     authorize('patient','admin','receptionist'), createAppointment);
router.put('/:id/cancel', cancelAppointment);
router.get('/:id/video',       getVideoRoom);
router.put('/:id/video/start', startVideoCall);
router.put('/:id/video/end',   endVideoCall);
router.put('/:id',   updateAppointment);
router.delete('/:id',authorize('admin','receptionist'), deleteAppointment);
module.exports = router;
