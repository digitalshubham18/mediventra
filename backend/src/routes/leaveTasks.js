// const router = require('express').Router();
// const { protect, authorize } = require('../middleware/auth');
// const {
//   getLeaves, applyLeave, reviewLeave, cancelLeave, getTodayLeaves,
//   getTasks, createTask, updateTask, deleteTask,
// } = require('../controllers/leaveTaskController');

// router.use(protect);

// // Leaves
// router.get('/leaves',         getLeaves);
// router.post('/leaves',        applyLeave);
// router.put('/leaves/:id/review', authorize('admin'), reviewLeave);
// router.put('/leaves/:id/cancel', cancelLeave);
// router.get('/leaves/today',   getTodayLeaves);

// // Tasks
// router.get('/tasks',          getTasks);
// router.post('/tasks',         authorize('admin','doctor','nurse'), createTask);
// router.put('/tasks/:id',      updateTask);
// router.delete('/tasks/:id',   authorize('admin'), deleteTask);

// module.exports = router;


const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLeaves, applyLeave, reviewLeave, cancelLeave, getTodayLeaves,
  getTasks, createTask, updateTask, deleteTask,
} = require('../controllers/leaveTaskController');

router.use(protect);

// Leaves
router.get('/leaves/today', getTodayLeaves);
router.get('/leaves',       getLeaves);
router.post('/leaves',      applyLeave);
router.put('/leaves/:id/review', authorize('admin'), reviewLeave);
router.put('/leaves/:id/cancel', cancelLeave);

// Tasks
router.get('/tasks',        getTasks);
router.post('/tasks',       authorize('admin','doctor','nurse'), createTask);
router.put('/tasks/:id',    updateTask);
router.delete('/tasks/:id', authorize('admin'), deleteTask);

module.exports = router;
