const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { createFeedback, getMyFeedback, getAllFeedback, respondToFeedback } = require('../controllers/feedbackController');

router.use(protect);
router.post('/',          createFeedback);
router.get('/mine',       getMyFeedback);
router.get('/',           authorize('admin'), getAllFeedback);
router.put('/:id',        authorize('admin'), respondToFeedback);

module.exports = router;
