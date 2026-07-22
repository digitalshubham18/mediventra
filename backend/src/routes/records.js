// const express = require('express');
// const router = express.Router();
// const {
//   getRecords, getRecord, createRecord, updateRecord, deleteRecord
// } = require('../controllers/recordReminderController');
// const { protect, authorize } = require('../middleware/auth');
// const upload = require('../middleware/upload');

// router.use(protect);
// router.get('/', getRecords);
// router.get('/:id', getRecord);
// router.post('/', authorize('admin', 'doctor', 'nurse'), (req, res, next) => { req.uploadFolder = 'records'; next(); }, upload.single('file'), createRecord);
// router.put('/:id', authorize('admin', 'doctor'), updateRecord);
// router.delete('/:id', authorize('admin', 'doctor'), deleteRecord);

// module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getRecords, getRecord, createRecord, updateRecord, deleteRecord,
} = require('../controllers/recordController');

const canCreate = ['admin','doctor','nurse','lab_technician'];

router.use(protect);

// Set upload folder
router.use((req, res, next) => { req.uploadFolder = 'records'; next(); });

// Support both 'file' (single doc) and 'labPhotos' (multiple images)
const uploadFields = upload.fields([
  { name: 'file',      maxCount: 1  },
  { name: 'labPhotos', maxCount: 10 },
]);

router.get('/',        getRecords);
router.get('/:id',     getRecord);
router.post('/',   authorize(...canCreate), uploadFields, createRecord);
router.put('/:id', authorize(...canCreate, 'admin'), uploadFields, updateRecord);
router.delete('/:id',  authorize('admin','doctor'),      deleteRecord);

module.exports = router;
