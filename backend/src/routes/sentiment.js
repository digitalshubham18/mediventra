const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSentimentReport } = require('../controllers/sentimentController');

router.get('/', protect, authorize('admin'), getSentimentReport);

module.exports = router;
