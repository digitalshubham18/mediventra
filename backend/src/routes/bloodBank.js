const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getInventory, updateInventory,
  requestDonation, getMyDonations, getAllDonations,
  updateDonationStatus, completeDonation, getCertificate,
  getEligibility,
} = require('../controllers/bloodBankController');

router.use(protect);

// Inventory — clinical/admin staff only. Patients must never see hospital
// blood stock levels (also enforced inside getInventory itself, so a
// direct API call can't bypass the route-level check either).
router.get('/inventory', authorize('admin','doctor','nurse','lab_technician','receptionist','pharmacist'), getInventory);
router.put('/inventory/:bloodGroup', authorize('admin','nurse','lab_technician'), updateInventory);

// Donations
router.get('/eligibility', authorize('patient'), getEligibility);
router.post('/donate', authorize('patient'), requestDonation);
router.get('/donations/mine', authorize('patient'), getMyDonations);
router.get('/donations', authorize('admin','nurse','lab_technician','receptionist'), getAllDonations);
router.put('/donations/:id/status', authorize('admin','nurse','lab_technician'), updateDonationStatus);
router.put('/donations/:id/complete', authorize('admin','nurse','lab_technician'), completeDonation);
router.get('/donations/:id/certificate', getCertificate); // internal auth check by ownership/role

module.exports = router;
