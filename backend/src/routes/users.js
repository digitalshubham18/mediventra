// // routes/users.js
// const express = require('express');
// const router = express.Router();
// const { getUsers, getUser, approveUser, updateUser, deleteUser, getDashboardStats } = require('../controllers/userController');
// const { protect, authorize } = require('../middleware/auth');

// router.use(protect);
// router.get('/stats', authorize('admin'), getDashboardStats);
// router.get('/', authorize('admin', 'doctor', 'nurse','patient'), getUsers);
// router.get('/:id', getUser);
// router.put('/:id/approve', authorize('admin'), approveUser);
// router.put('/:id', authorize('admin'), updateUser);
// router.delete('/:id', authorize('admin'), deleteUser);
// module.exports = router;

const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAll, getOne, update, approve, deleteUser, getStats, getOnlineUsers, createPatient, updateVitals, getOnDutyStaff } = require('../controllers/userController');

router.use(protect);
router.get('/stats', authorize('admin'), getStats);
router.get('/online', authorize('admin'), getOnlineUsers);
router.get('/on-duty', getOnDutyStaff);
router.get('/',      getAll);
router.post('/patients', authorize('admin','doctor','nurse'), createPatient);
router.put('/:id/vitals', authorize('admin','doctor','nurse'), updateVitals);
router.get('/:id',   getOne);
router.put('/:id',       authorize('admin'), update);
router.put('/:id/approve', authorize('admin'), approve);
router.delete('/:id',    authorize('admin'), deleteUser);

module.exports = router;
