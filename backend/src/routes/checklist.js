const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getToday, toggleItem } = require('../controllers/checklistController');

router.use(protect);
router.get('/today', getToday);
router.put('/today', toggleItem);

module.exports = router;
