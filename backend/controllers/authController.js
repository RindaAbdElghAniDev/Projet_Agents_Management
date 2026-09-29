const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const { sendResetCodeEmail } = require('../config/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_CODE_TTL_MINUTES = 15;

const generateToken = (user) =>
  jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword =
      typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (name.length < 2) {
      return res.status(400).json({ message: 'Le nom doit contenir au moins 2 caractères.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Le rôle par défaut est AGENT : seul un admin existant pourra créer un autre admin plus tard
    const userId = await User.create({ name, email, password: hashedPassword, role: 'AGENT' });
    const user = await User.findById(userId);

    res.status(201).json({ message: 'Compte créé avec succès.', user });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
    }

    const user = await User.findByEmail(email);
    const invalidMessage = 'Email ou mot de passe incorrect.';

    if (!user) {
      return res.status(401).json({ message: invalidMessage });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: invalidMessage });
    }

    const token = generateToken(user);

    res.json({
      message: 'Connexion réussie.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me (protégé)
const getMe = (req, res) => {
  res.json({ user: req.user });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }

    const user = await User.findByEmail(email);

    // Même réponse que l'email existe ou non : on ne révèle pas quels emails sont enregistrés
    const genericMessage = 'Si cet email existe, un code de vérification a été envoyé.';

    if (!user) {
      return res.json({ message: genericMessage });
    }

    // Code à 6 chiffres, ex: "042917"
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

    await User.setResetCode(email, code, expiresAt);
    await sendResetCodeEmail(email, code);

    res.json({ message: genericMessage });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-reset-code
const verifyResetCode = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ message: 'Email et code obligatoires.' });
    }

    const user = await User.findByValidResetCode(email, code);
    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    res.json({ message: 'Code valide.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !code) {
      return res.status(400).json({ message: 'Email et code obligatoires.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    // On revérifie le code ici : ne jamais faire confiance à l'étape précédente seule
    const user = await User.findByValidResetCode(email, code);
    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updatePasswordAndClearCode(user.id, hashedPassword);

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, forgotPassword, verifyResetCode, resetPassword };