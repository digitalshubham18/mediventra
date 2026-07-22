const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getForRole, create, acknowledge } = require('../controllers/handoverController');

router.use(protect);
router.get('/', getForRole);
router.post('/', create);
router.put('/:id/acknowledge', acknowledge);

module.exports = router;
