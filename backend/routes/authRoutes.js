const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Routes publiques
router.post('/register', register);
router.post('/login', login);
// POST /api/auth/logout (utilisateur connecté)
router.post('/logout', protect, logout);
// Route privée : utilisateur connecté (n'importe quel rôle)
router.get('/me', protect, getMe);


module.exports = router;