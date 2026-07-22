const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createBugReport, getBugReports, updateBugReport } = require('../controllers/bugReportController');
const upload = require('../middleware/upload');

const setBugReportFolder = (req, res, next) => { req.uploadFolder = 'bug-reports'; next(); };

router.use(protect);

// Any logged-in user can report a bug, optionally with a screenshot
router.post('/', setBugReportFolder, upload.single('image'), createBugReport);

// Only admins can review the list / change status
router.get('/',       authorize('admin'), getBugReports);
router.put('/:id',    authorize('admin'), updateBugReport);

module.exports = router;
