const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { create, getActive, getMine, acknowledge, resolve } = require('../controllers/nurseCallController');

router.use(protect);
router.post('/',              authorize('patient'), create);
router.get('/mine',            authorize('patient'), getMine);
router.get('/',                authorize('nurse','admin'), getActive);
router.put('/:id/acknowledge', authorize('nurse','admin'), acknowledge);
router.put('/:id/resolve',     authorize('nurse','admin'), resolve);

module.exports = router;
