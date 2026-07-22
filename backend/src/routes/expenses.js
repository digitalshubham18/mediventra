const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getAll, create, update, remove } = require('../controllers/expenseController');

router.use(protect, authorize('admin', 'finance'));
router.use((req, res, next) => { req.uploadFolder = 'expenses'; next(); });

router.get('/',        getAll);
router.post('/',       upload.single('attachment'), create);
router.put('/:id',     upload.single('attachment'), update);
router.delete('/:id',  remove);

module.exports = router;
