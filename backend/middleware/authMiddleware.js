const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Agent = require('../models/agentModel');

// SEC-07 — Séparé de `protect` (qui ne contrôle que : JWT, existence du compte, token_version).
// Exiger une fiche agent n'a de sens que sur les routes métier qui manipulent des données
// d'agent. L'imposer dans `protect` bloquait aussi /auth/me, /departments et la création
// de la fiche elle-même, rendant le blocage irrémédiable.
// Un compte ADMIN n'est jamais concerné : son accès est régi par authorizeAdmin.
const requireAgentProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'AGENT') {
      return next();
    }

    const agent = await Agent.findByUserId(req.user.id);

    if (!agent) {
      return res.status(403).json({
        message:
          "Votre compte n'est pas encore associé à une fiche agent. Veuillez compléter votre profil.",
      });
    }
    if (agent.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Votre compte est désactivé.' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Accès refusé : token manquant.' });
    }

    const token = header.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur introuvable.' });
    }

    // SEC-08 : révocation des sessions. Le claim tokenVersion du JWT est comparé à la
    // valeur en base. Un écart (logout, changement de mot de passe) invalide le jeton.
    // Un JWT émis AVANT la mise en place de ce mécanisme ne contient pas le claim :
    // il est alors refusé (401) pour imposer une reconnexion plutôt que de l'accepter.
    if (decoded.tokenVersion === undefined || decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({ message: 'Session invalide. Veuillez vous reconnecter.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, requireAgentProfile };