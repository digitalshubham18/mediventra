const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { download } = require('../controllers/healthSummaryController');

router.use(protect);
router.get('/', download);
router.get('/:patientId', download);

module.exports = router;
