// const express = require('express');
// const router  = express.Router();
// const { body } = require('express-validator');
// const { protect } = require('../middleware/auth');
// const {
//   initiateRegister, verifyRegister,
//   initiateLogin, verifyLogin,
//   resendOtp, forgotPassword, resetPassword,
//   getMe, updateProfile, logout, changePassword,
// } = require('../controllers/authController');

// const emailRule    = body('email').isEmail().withMessage('Valid email required');
// const passwordRule = body('password').isLength({ min: 6 }).withMessage('Password min 6 chars');
// const nameRule     = body('name').trim().notEmpty().withMessage('Name required');

// router.post('/register/initiate', [nameRule, emailRule, passwordRule], initiateRegister);
// router.post('/register/verify',   [emailRule, body('otp').notEmpty()], verifyRegister);
// router.post('/login/initiate',    [emailRule, passwordRule], initiateLogin);
// router.post('/login/verify',      [emailRule, body('otp').notEmpty()], verifyLogin);

// // Legacy aliases (redirect to OTP flow)
// router.post('/register', [nameRule, emailRule, passwordRule], initiateRegister);
// router.post('/login',    [emailRule, passwordRule], initiateLogin);

// router.post('/resend-otp',      resendOtp);
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password',  resetPassword);

// router.get('/me',              protect, getMe);
// router.put('/profile',         protect, updateProfile);
// router.post('/logout',         protect, logout);
// router.put('/change-password', protect, changePassword);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  sendRegisterOTP, register, login, verifyLoginOtp, getMe,
  updateProfile, uploadAvatar, logout, changePassword,
  forgotPassword, resetPassword,
  requestEmailChangeOTP, confirmEmailChange,
  requestPhoneChange, getMyPhoneChangeRequests,
  getPhoneChangeRequests, approvePhoneChangeRequest, rejectPhoneChangeRequest,
} = require('../controllers/authController');
const { googleLogin, googleCallback, githubLogin, githubCallback } = require('../controllers/oauthController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const setAvatarFolder = (req, res, next) => { req.uploadFolder = 'avatars'; next(); };

router.post('/send-register-otp', sendRegisterOTP);

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('otp').notEmpty().withMessage('OTP is required'),
], register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], login);

router.post('/verify-login-otp', [
  body('email').isEmail(),
  body('otp').notEmpty(),
], verifyLoginOtp);

router.get('/me',                protect, getMe);
router.put('/profile',           protect, updateProfile);
router.post('/avatar',           protect, setAvatarFolder, upload.single('avatar'), uploadAvatar);
router.post('/logout',           protect, logout);
router.put('/change-password',   protect, changePassword);
router.post('/email/request-otp', protect, requestEmailChangeOTP);
router.post('/email/confirm',     protect, confirmEmailChange);

// Phone number changes now require admin approval instead of a self-serve
// OTP — the user files a request, and an admin reviews it.
router.post('/phone/request-change', protect, requestPhoneChange);
router.get('/phone/my-requests',     protect, getMyPhoneChangeRequests);
router.get('/phone/requests',                protect, authorize('admin'), getPhoneChangeRequests);
router.put('/phone/requests/:id/approve',     protect, authorize('admin'), approvePhoneChangeRequest);
router.put('/phone/requests/:id/reject',      protect, authorize('admin'), rejectPhoneChangeRequest);

router.post('/forgot-password',          forgotPassword);
router.post('/reset-password',           resetPassword);

// Google / GitHub OAuth — real browser redirects (not JSON API calls),
// but still covered by the same /api/auth rate limiter as everything else.
router.get('/google',          googleLogin);
router.get('/google/callback', googleCallback);
router.get('/github',          githubLogin);
router.get('/github/callback', githubCallback);

module.exports = router;
