// const express = require('express');
// const router = express.Router();
// const { initiatePayment, confirmPayment, getPaymentHistory } = require('../controllers/paymentController');
// const { protect } = require('../middleware/auth');

// router.use(protect);
// router.post('/initiate', initiatePayment);
// router.post('/confirm', confirmPayment);
// router.get('/history', getPaymentHistory);

// module.exports = router;


const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { createOrder, verifyPayment, simulatePayment, getPayments, getPayment, initiate, confirm, createManualInvoice } = require('../controllers/paymentController');
router.use(protect);
router.post('/initiate',     initiate);
router.post('/confirm',      confirm);
router.post('/create-order', createOrder);
router.post('/verify',       verifyPayment);
router.post('/simulate',     simulatePayment);
router.post('/manual-invoice', authorize('admin','finance'), createManualInvoice);
router.get('/',              getPayments);
router.get('/:id',           getPayment);
module.exports = router;
