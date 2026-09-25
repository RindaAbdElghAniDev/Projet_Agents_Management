const authorizeAdmin = (req, res, next) => {
  // req.user est rempli par protect : authorizeAdmin doit toujours venir APRÈS protect
  if (!req.user) {
    const error = new Error('Non authentifié');
    error.statusCode = 401;
    return next(error);
  }

  if (req.user.role !== 'ADMIN') {
    const error = new Error('Accès interdit : réservé aux administrateurs');
    error.statusCode = 403;
    return next(error);
  }

  next();
};

module.exports = { authorizeAdmin };