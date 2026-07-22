const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getCabins, getCabinForDoctor, upsertCabin, deleteCabin } = require('../controllers/doctorCabinController');

router.use(protect);
router.get('/',                     getCabins);
router.get('/by-doctor/:doctorId',  getCabinForDoctor);
router.post('/',                    upsertCabin);
router.delete('/:id',               deleteCabin);

module.exports = router;
