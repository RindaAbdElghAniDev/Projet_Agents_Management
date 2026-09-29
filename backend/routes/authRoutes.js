const express = require('express');
const {
  register,
  login,
  getMe,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { forgotPasswordLimiter, verifyCodeLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/verify-reset-code', verifyCodeLimiter, verifyResetCode);
router.post('/reset-password', resetPassword);

module.exports = router;