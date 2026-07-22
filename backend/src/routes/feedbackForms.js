const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllForms, createForm, updateForm, deleteForm, getResults,
  getMyPendingForms, submitResponse,
} = require('../controllers/feedbackFormController');

router.use(protect);

// Any logged-in user — see/answer forms targeted at their role
router.get('/mine', getMyPendingForms);
router.post('/:id/respond', submitResponse);

// Admin only — build and review forms
router.get('/', authorize('admin'), getAllForms);
router.post('/', authorize('admin'), createForm);
router.put('/:id', authorize('admin'), updateForm);
router.delete('/:id', authorize('admin'), deleteForm);
router.get('/:id/results', authorize('admin'), getResults);

module.exports = router;
