const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMine, getForPatient, create, updateMilestone } = require('../controllers/dischargeController');

router.use(protect);
router.get('/mine', authorize('patient'), getMine);
router.get('/patient/:patientId', authorize('doctor', 'admin', 'nurse'), getForPatient);
router.post('/', authorize('doctor'), create);
router.put('/:id/milestones/:milestoneId', updateMilestone);

module.exports = router;
