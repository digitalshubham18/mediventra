const express = require('express');
const router = express.Router();
const {
  getReminders, createReminder, updateReminder, logAdherence, deleteReminder
} = require('../controllers/recordReminderController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getReminders);
router.post('/', createReminder);
router.put('/:id', updateReminder);
router.post('/:id/adherence', logAdherence);
router.delete('/:id', deleteReminder);

module.exports = router;