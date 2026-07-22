// const express = require('express');
// const router = express.Router();
// const { getDashboardAnalytics } = require('../controllers/analyticsController');
// const { protect, authorize } = require('../middleware/auth');

// router.use(protect);
// router.get('/', authorize('admin', 'doctor'), getDashboardAnalytics);

// module.exports = router;

const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getDashboardAnalytics); // all authenticated staff

module.exports = router;