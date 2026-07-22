const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAuditLog } = require('../controllers/auditLogController');

router.get('/', protect, authorize('admin'), getAuditLog);

module.exports = router;
