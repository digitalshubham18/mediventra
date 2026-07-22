const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMyPolicies, getPatientPolicies, addPolicy, deletePolicy,
  getMyClaims, submitClaim,
  getAllClaims, reviewClaim, markClaimPaid,
} = require('../controllers/insuranceController');

router.use(protect);
router.use((req, res, next) => { req.uploadFolder = 'insurance'; next(); });

// Patient — policies
router.get('/policies',      authorize('patient'), getMyPolicies);
router.get('/policies/patient/:patientId', authorize('admin','finance','receptionist','doctor'), getPatientPolicies);
router.post('/policies',     authorize('patient'), upload.single('cardImage'), addPolicy);
router.delete('/policies/:id', authorize('patient'), deletePolicy);

// Patient — claims
router.get('/claims/mine',   authorize('patient'), getMyClaims);
router.post('/claims',       authorize('patient'), upload.array('documents', 8), submitClaim);

// Staff — claims review
router.get('/claims',            authorize('admin','finance'), getAllClaims);
router.put('/claims/:id/review', authorize('admin','finance'), reviewClaim);
router.put('/claims/:id/pay',    authorize('admin','finance'), markClaimPaid);

module.exports = router;
