const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMyFamily, addFamilyMember, removeFamilyMember, loginAsFamilyMember } = require('../controllers/familyController');

router.use(protect, authorize('patient'));
router.get('/', getMyFamily);
router.post('/', addFamilyMember);
router.post('/:linkId/login-as', loginAsFamilyMember);
router.delete('/:linkId', removeFamilyMember);

module.exports = router;
