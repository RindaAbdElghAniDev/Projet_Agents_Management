const express = require('express');
const {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  forgotPasswordLimiter,
  verifyCodeLimiter,
  resetPasswordLimiter,
  loginLimiter,
  registerLimiter,
} = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/verify-reset-code', verifyCodeLimiter, verifyResetCode);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// Profil et mot de passe de l'utilisateur connecté
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;