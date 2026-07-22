const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createProvider, getProviders, updateProvider, addRate, updateRate, deleteRate,
  createPreAuth, getPreAuths, respondToPreAuth, cancelPreAuth,
} = require('../controllers/tpaController');

router.use(protect);

// Provider & rate management — store/finance managed
router.get('/providers', getProviders);
router.post('/providers', authorize('admin', 'finance'), createProvider);
router.put('/providers/:id', authorize('admin', 'finance'), updateProvider);
router.post('/providers/:id/rates', authorize('admin', 'finance'), addRate);
router.put('/providers/:id/rates/:rateId', authorize('admin', 'finance'), updateRate);
router.delete('/providers/:id/rates/:rateId', authorize('admin', 'finance'), deleteRate);

// Pre-authorization
router.get('/pre-auth', getPreAuths);
router.post('/pre-auth', authorize('admin', 'finance', 'receptionist', 'doctor'), createPreAuth);
router.put('/pre-auth/:id/respond', authorize('admin', 'finance'), respondToPreAuth);
router.put('/pre-auth/:id/cancel', authorize('admin', 'finance', 'receptionist', 'doctor'), cancelPreAuth);

module.exports = router;
