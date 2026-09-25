const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  try {
    // 1. Lire l'en-tête : "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Accès refusé : token manquant');
      error.statusCode = 401;
      throw error;
    }

    // 2. Extraire le token (la partie après "Bearer ")
    const token = authHeader.split(' ')[1];

    // 3. Vérifier la signature et l'expiration
    // Si le token est invalide ou expiré, jwt.verify lance une erreur
    // (JsonWebTokenError / TokenExpiredError), gérée par errorMiddleware en 401
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Retrouver l'utilisateur dans MySQL avec l'id contenu dans le token
    const user = await User.findById(decoded.userId);

    if (!user) {
      const error = new Error('Utilisateur introuvable : veuillez vous reconnecter');
      error.statusCode = 401;
      throw error;
    }

    // 5. Attacher l'utilisateur à la requête pour la suite
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };