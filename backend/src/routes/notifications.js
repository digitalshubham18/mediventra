const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getMine, getUnreadCount, markRead, markAllRead, remove } = require('../controllers/notificationController');

router.use(protect);
router.get('/',               getMine);
router.get('/unread-count',   getUnreadCount);
router.put('/read-all',       markAllRead);
router.put('/:id/read',       markRead);
router.delete('/:id',         remove);

module.exports = router;
