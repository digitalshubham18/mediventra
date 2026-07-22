const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getHealth } = require('../controllers/systemController');

router.get('/health', protect, authorize('admin', 'it_technician'), getHealth);

module.exports = router;
