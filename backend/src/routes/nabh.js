const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createStandard, getStandards, updateStandard, deactivateStandard,
  createAudit, getAudits, getAudit, updateAuditItem, completeAudit, getQualityIndicators,
} = require('../controllers/nabhController');

router.use(protect);
router.use(authorize('admin')); // quality/compliance is an admin-only concern in this build

router.get('/standards', getStandards);
router.post('/standards', createStandard);
router.put('/standards/:id', updateStandard);
router.delete('/standards/:id', deactivateStandard);

router.get('/audits', getAudits);
router.post('/audits', createAudit);
router.get('/audits/:id', getAudit);
router.put('/audits/:id/item', updateAuditItem);
router.put('/audits/:id/complete', completeAudit);

router.get('/quality-indicators', getQualityIndicators);

module.exports = router;
