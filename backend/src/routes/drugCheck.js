const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { check } = require('../controllers/drugCheckController');

router.post('/', protect, authorize('doctor', 'pharmacist'), check);

module.exports = router;
