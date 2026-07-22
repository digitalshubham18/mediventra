const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getForecast } = require('../controllers/staffingController');

router.get('/forecast', protect, authorize('admin'), getForecast);

module.exports = router;
