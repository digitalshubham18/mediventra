// const router = require('express').Router();
// const { protect, authorize } = require('../middleware/auth');
// const { getSalaries, getMySalarySummary, generateSalary, bulkGenerateSalary, creditSalary, updateSalary } = require('../controllers/salaryController');
// router.use(protect);
// router.get('/',          getSalaries);
// router.get('/my-summary', getMySalarySummary);
// router.post('/generate', authorize('admin'), generateSalary);
// router.post('/bulk',     authorize('admin'), bulkGenerateSalary);
// router.put('/:id/credit',authorize('admin'), creditSalary);
// router.put('/:id',       authorize('admin'), updateSalary);
// module.exports = router;


const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getSalaries, getMySummary, generateSalary, bulkGenerate, creditSalary, updateSalary, addExtraPayment, attendancePreview } = require('../controllers/salaryController');

router.use(protect);
router.get('/my-summary',            getMySummary);
router.get('/attendance-preview',    authorize('finance'), attendancePreview);
router.get('/',                      getSalaries);
router.post('/generate',             authorize('finance'), generateSalary);
router.post('/bulk',                 authorize('finance'), bulkGenerate);
router.post('/extra-payment',        authorize('finance'), addExtraPayment);
router.put('/:id/credit',            authorize('finance'), creditSalary);
router.put('/:id',                   authorize('finance'), updateSalary);

module.exports = router;
