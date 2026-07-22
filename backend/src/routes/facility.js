const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getRooms, createRoom, updateRoom, deleteRoom,
  getSchedules, createSchedule, bulkSeedSchedules, updateSchedule, deleteSchedule,
  generateWeeklyRoutine,
  getMessages, sendMessage, getChatUsers, getUnreadCounts, markRoomRead,
} = require('../controllers/facilityController');

router.use(protect);

// Rooms
router.get('/rooms',              getRooms);
router.post('/rooms',             authorize('admin'), createRoom);
router.put('/rooms/:id',          updateRoom);
router.delete('/rooms/:id',       authorize('admin'), deleteRoom);

// Schedules
router.get('/schedules',          getSchedules);
router.post('/schedules',         authorize('admin'), createSchedule);
router.post('/schedules/bulk',    authorize('admin'), bulkSeedSchedules);
router.post('/schedules/generate-routine', authorize('admin'), generateWeeklyRoutine);
router.put('/schedules/:id',      updateSchedule);   // no authorize — controller checks ownership
router.delete('/schedules/:id',   authorize('admin'), deleteSchedule);

// Chat
router.get('/chat/messages',      getMessages);
router.post('/chat/send',         sendMessage);
router.get('/chat/users',         getChatUsers);
router.get('/chat/unread',        getUnreadCounts);
router.post('/chat/read',         markRoomRead);

module.exports = router;
