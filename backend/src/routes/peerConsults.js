const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSent, getReceived, getSpecialists, create, respond } = require('../controllers/peerConsultController');

router.use(protect, authorize('doctor'));
router.get('/sent', getSent);
router.get('/received', getReceived);
router.get('/specialists', getSpecialists);
router.post('/', create);
router.put('/:id/respond', respond);

module.exports = router;
