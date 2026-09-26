const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!name || !email || !password || !confirmPassword) {
      throw createError('Tous les champs sont obligatoires', 400);
    }
    if (!EMAIL_REGEX.test(email)) {
      throw createError("Format d'email invalide", 400);
    }
    if (password.length < 6) {
      throw createError('Le mot de passe doit contenir au moins 6 caractères', 400);
    }
    if (password !== confirmPassword) {
      throw createError('Les mots de passe ne correspondent pas', 400);
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw createError('Cet email est déjà utilisé', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await User.create({ name, email, password: hashedPassword });

    await Agent.linkUserByEmail(userId, email);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      user: { id: userId, name, email, role: 'AGENT' },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      throw createError('Email et mot de passe obligatoires', 400);
    }

    const user = await User.findByEmail(email);
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      throw createError('Email ou mot de passe incorrect', 401);
    }

    const token = generateToken(user.id);

    await Log.create(user.id, 'LOGIN', `${user.name} s'est connecté`);

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await Log.create(req.user.id, 'LOGOUT', `${req.user.name} s'est déconnecté`);
    res.json({ success: true, message: 'Déconnexion enregistrée' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name) {
      throw createError('Le nom est obligatoire', 400);
    }
    if (name.length > 100) {
      throw createError('Le nom ne doit pas dépasser 100 caractères', 400);
    }
    if (!EMAIL_REGEX.test(email)) {
      throw createError("Format d'email invalide", 400);
    }

    // L'email ne doit pas appartenir à un AUTRE compte
    const existing = await User.findByEmail(email);
    if (existing && existing.id !== req.user.id) {
      throw createError('Cet email est déjà utilisé par un autre compte', 409);
    }

    await User.updateProfile(req.user.id, { name, email });
    const user = await User.findById(req.user.id);

    await Log.create(req.user.id, 'UPDATE_PROFILE', `${user.name} a modifié son profil`);

    res.json({ success: true, message: 'Profil mis à jour avec succès', user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/password
const changePassword = async (req, res, next) => {
  try {
    const body = req.body || {};
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      throw createError('Tous les champs sont obligatoires', 400);
    }
    if (newPassword.length < 6) {
      throw createError('Le nouveau mot de passe doit contenir au moins 6 caractères', 400);
    }

    const user = await User.findByIdWithPassword(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw createError('Mot de passe actuel incorrect', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(req.user.id, hashedPassword);

    await Log.create(req.user.id, 'CHANGE_PASSWORD', `${user.name} a changé son mot de passe`);

    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout, updateProfile, changePassword };