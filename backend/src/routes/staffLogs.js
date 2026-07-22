const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getLogs, createLog, resolveLog, closeLog, deleteLog } = require('../controllers/staffLogController');

router.use(protect);
router.get('/',            getLogs);
router.post('/',           createLog);
router.put('/:id/resolve', resolveLog);
router.put('/:id/close',   closeLog);
router.delete('/:id',      deleteLog);

module.exports = router;
