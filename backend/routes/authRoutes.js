const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, getMe, logout, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Limite les tentatives de connexion : 10 essais par IP toutes les 15 minutes.
// Protège contre les attaques par force brute sur les mots de passe.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
    });
  },
});

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;