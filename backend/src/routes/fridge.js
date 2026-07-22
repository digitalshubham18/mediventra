const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, addReading } = require('../controllers/fridgeController');

router.use(protect);
router.get('/', getAll);
router.post('/', addReading);

module.exports = router;
