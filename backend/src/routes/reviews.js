const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { createReview, getDoctorReviews, getMyPendingRatings } = require('../controllers/reviewController');

router.use(protect);
router.get('/mine',              getMyPendingRatings);
router.get('/doctor/:doctorId',  getDoctorReviews);
router.post('/',                 createReview);

module.exports = router;
