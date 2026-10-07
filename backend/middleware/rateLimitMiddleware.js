const { rateLimit } = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur dédié au changement de mot de passe lui-même (SEC-01).
// Compteur isolé de /verify-reset-code : c'est cette étape qui modifie réellement le compte,
// elle ne doit donc pas partager le même budget de tentatives que la simple vérification du code.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter de connexion (SEC-03) : le mot de passe n'exige que 6 caractères,
// le bruteforce doit donc être bloqué tôt. skipSuccessfulRequests ne compte que les ÉCHECS :
// un utilisateur légitime qui se trompe puis réussit n'est jamais bloqué.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter de création de compte (SEC-04) : le risque est la saturation et l'énumération
// d'emails, pas le devinage d'un secret. Fenêtre d'une heure, seuil volontairement
// plus permissif pour ne pas freiner une équipe qui s'inscrit le même jour.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Trop de créations de compte. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  forgotPasswordLimiter,
  verifyCodeLimiter,
  resetPasswordLimiter,
  loginLimiter,
  registerLimiter,
};