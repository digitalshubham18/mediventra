const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getConfig, updateConfig } = require('../controllers/hospitalConfigController');
const upload = require('../middleware/upload');

const setSignatureFolder = (req, res, next) => { req.uploadFolder = 'signatures'; next(); };

router.use(protect);
router.get('/', getConfig);
router.put('/', authorize('admin'), setSignatureFolder, upload.single('signature'), updateConfig);

module.exports = router;
