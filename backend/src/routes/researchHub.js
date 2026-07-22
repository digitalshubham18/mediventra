const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getFeed } = require('../controllers/researchHubController');

router.get('/', protect, authorize('doctor'), getFeed);

module.exports = router;
