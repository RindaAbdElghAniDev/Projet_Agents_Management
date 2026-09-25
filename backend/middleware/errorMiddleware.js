// Appelé quand aucune route ne correspond à la requête
const notFound = (req, res, next) => {
  const error = new Error(`Route introuvable : ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Gestionnaire global des erreurs
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erreur interne du serveur';

  // JSON invalide envoyé par le client
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'JSON invalide dans le corps de la requête';
  }

  // Erreurs MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Cette valeur existe déjà (doublon)';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = "Référence invalide : l'élément lié n'existe pas";
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'Suppression impossible : cet élément est encore utilisé ailleurs';
  } else if (typeof err.code === 'string' && err.code.startsWith('ER_')) {
    statusCode = 500;
    message = 'Erreur de base de données';
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token invalide';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expiré, veuillez vous reconnecter';
  }

  // On garde les détails des erreurs 500 dans le terminal
  if (statusCode === 500) {
    console.error(err);
    // En production, on ne montre jamais les détails techniques au client
    if (process.env.NODE_ENV === 'production') {
      message = 'Erreur interne du serveur';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = { notFound, errorHandler };