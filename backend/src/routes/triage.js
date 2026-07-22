const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getQueue } = require('../controllers/triageController');

router.get('/queue', protect, authorize('nurse', 'receptionist', 'admin', 'doctor'), getQueue);

module.exports = router;
