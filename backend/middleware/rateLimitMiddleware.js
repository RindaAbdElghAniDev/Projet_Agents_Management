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

module.exports = { forgotPasswordLimiter, verifyCodeLimiter };