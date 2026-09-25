const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');
// Crée une erreur avec un code HTTP (lue par errorMiddleware)
const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Génère un JWT contenant uniquement l'id de l'utilisateur
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
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

    // 1. Validation côté serveur
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

    // 2. L'email existe-t-il déjà ?
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw createError('Cet email est déjà utilisé', 409);
    }

    // 3. Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
  
    // 4. Enregistrement dans MySQL (le rôle est toujours AGENT)
    const userId = await User.create({
      name,
      email,
      password: hashedPassword,
    });
  await Agent.linkUserByEmail(userId, email);
    // 5. Réponse sans le mot de passe
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

    // 1. Chercher l'utilisateur
    const user = await User.findByEmail(email);

    // 2. Comparer le mot de passe
    // Même message si l'email n'existe pas ou si le mot de passe est faux
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      throw createError('Email ou mot de passe incorrect', 401);
    }

    // 3. Générer le token
    const token = generateToken(user.id);
    // Log de connexion (ne bloque jamais la réponse en cas d'erreur)
    await Log.create(user.id, 'LOGIN', `${user.name} s'est connecté`);
    // 4. Réponse : token + infos utilisateur (sans le mot de passe)
    res.json({
      success: true,
      message: 'Connexion réussie',
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
const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
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
module.exports = { register, login, getMe, logout };