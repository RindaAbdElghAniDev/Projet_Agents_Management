const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');
const PasswordReset = require('../models/passwordResetModel');
const { sendResetCodeEmail } = require('../config/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_CODE_TTL_MINUTES = 15;

// SHA-256 déterministe : la vérification se fait par égalité SQL sur token_hash,
// ce qui impose un hachage déterministe (bcrypt, avec son sel aléatoire, ne conviendrait pas).
// Seul le HASH est stocké en base ; le code en clair n'existe que dans l'email de l'utilisateur.
const hashResetCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

// SEC-08 : le claim tokenVersion permet de révoquer tous les JWT antérieurs à un
// logout ou un changement de mot de passe. `role` est conservé pour compatibilité mais
// n'est PAS utilisé comme source d'autorisation (le middleware relit la base).
const generateToken = (user) =>
  jwt.sign({ userId: user.id, role: user.role, tokenVersion: user.token_version }, process.env.JWT_SECRET, {
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

    const existingUser = await User.findSafeByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Le rôle par défaut est AGENT : seul un admin existant pourra créer un autre admin plus tard
    const userId = await User.create({ name, email, password: hashedPassword, role: 'AGENT' });
    const user = await User.findById(userId);

    // SEC-09 : si une fiche agent existe déjà avec cet email mais sans compte rattaché
    // (fiche créée avant l'inscription), on la lie au nouveau compte.
    // linkUserByEmail filtre sur "user_id IS NULL" : un lien existant n'est jamais écrasé,
    // et l'opération reste sans effet s'il n'existe aucune fiche correspondante.
    await Agent.linkUserByEmail(user.id, email);

    // SEC-13 : audit de la création de compte, après la liaison de la fiche agent.
    // Aucun secret (mot de passe, hash, JWT, token, email) n'est journalisé.
    await Log.create(user.id, 'REGISTER', `${user.name} a créé son compte`);

    // P1 (Stabilization) : allowlist identique à login / getMe — la réponse n'expose
    // ni token_version ni created_at (ni aucun autre champ interne).
    res.status(201).json({
      message: 'Compte créé avec succès.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
    }

    const user = await User.findAuthByEmail(email);
    const invalidMessage = 'Email ou mot de passe incorrect.';

    if (!user) {
      return res.status(401).json({ message: invalidMessage });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: invalidMessage });
    }

    // SEC-13 : le log est écrit UNIQUEMENT après un bcrypt.compare réussi.
    // Aucun secret (mot de passe, hash, JWT, token, email) n'est journalisé.
    await Log.create(user.id, 'LOGIN', `${user.name} s'est connecté`);
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
// SEC-12 : req.user porte la projection INTERNE du middleware, qui contient
// volontairement token_version (comparaison SEC-08, cf. authMiddleware l.60) et
// created_at. Cette projection ne doit jamais etre serialisee telle quelle :
// on applique une allowlist explicite, identique a celle de la reponse de login.
const getMe = (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

// POST /api/auth/logout (protégé)
// SEC-08 : le JWT devient réellement révocable. On incrémente token_version, ce qui
// invalide TOUS les JWT émis précédemment pour ce compte (celui-ci compris). Un éventuel
// jeton volé devient donc inutilisable dès la déconnexion, au lieu de rester valide 1 jour.
const logout = async (req, res, next) => {
  try {
    await User.incrementTokenVersion(req.user.id);
    await Log.create(req.user.id, 'LOGOUT', `${req.user.name} s'est déconnecté`);
    res.json({ message: 'Déconnexion réussie.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }

    const user = await User.findSafeByEmail(email);

    // Même réponse que l'email existe ou non : on ne révèle pas quels emails sont enregistrés
    const genericMessage = 'Si cet email existe, un code de vérification a été envoyé.';

    if (!user) {
      return res.json({ message: genericMessage });
    }

    // Code à 6 chiffres, ex: "042917"
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

    // On ne stocke que le HASH du code : un dump de la base ne livre aucun code exploitable.
    // Les demandes précédentes sont invalidées : une seule demande active par utilisateur.
    await PasswordReset.invalidateAllForUser(user.id);
    await PasswordReset.create(user.id, hashResetCode(code), expiresAt);
    // L'email reçoit le code EN CLAIR, jamais le hash.
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

    // Défense en profondeur : on garde l'email comme second facteur d'appartenance.
    // Sans utilisateur → même erreur générique (aucune fuite d'information).
    const user = await User.findSafeByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    // Le code reçu est hashé avant toute recherche : il ne quitte jamais ce processus.
    const tokenHash = hashResetCode(code);
    const token = await PasswordReset.findValidByHash(tokenHash);

    // Un token absent, expiré, déjà utilisé, ou appartenant à un AUTRE compte
    // produit exactement la même erreur : rien ne trahit l'existence du compte.
    if (!token || token.user_id !== user.id) {
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
    const user = await User.findSafeByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    const tokenHash = hashResetCode(code);
    const token = await PasswordReset.findValidByHash(tokenHash);
    if (!token || token.user_id !== user.id) {
      return res.status(400).json({ message: 'Code invalide ou expiré.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // L'identité provient du TOKEN, jamais du body de la requête.
    await User.updatePasswordAndClearCode(token.user_id, hashedPassword);

    // SEC-08 : un changement de mot de passe doit déconnecter toutes les sessions
    // existantes. Incrémente token_version -> les JWT déjà émis deviennent invalides.
    await User.incrementTokenVersion(token.user_id);

    // Usage unique : le token ne pourra plus jamais servir, même si le code fuite.
    await PasswordReset.markAsUsed(token.id);

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile (protégé)
// Met à jour le nom et l'email de l'utilisateur connecté.
// Le rôle, l'id et le mot de passe ne sont jamais modifiables via cette route.
// Si l'email change réellement, token_version est incrémenté (SEC-08) : les JWT déjà
// émis deviennent invalides et l'utilisateur doit se reconnecter.
const updateProfile = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name) {
      return res.status(400).json({ message: 'Le nom est obligatoire.' });
    }
    if (name.length > 100) {
      return res.status(400).json({ message: 'Le nom ne doit pas dépasser 100 caractères.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }

    const current = await User.findById(req.user.id);
    if (!current) {
      return res.status(401).json({ message: 'Utilisateur introuvable.' });
    }

    // Unicité de l'email : vérifiée applicativement pour renvoyer un message clair.
    // La contrainte UNIQUE reste le filet de sécurité en base (cf. errorMiddleware ER_DUP_ENTRY).
    if (email !== current.email) {
      const taken = await User.findSafeByEmail(email);
      if (taken) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
      }
    }

    // Correctif A1 : comparaison stricte des valeurs demandées avec celles en base,
    // AVANT toute écriture. mysql2 active FOUND_ROWS par défaut : affectedRows compte
    // les lignes APPARIÉES, donc un UPDATE à valeurs identiques renvoie 1 et non 0 —
    // la branche `affected === 0` ci-dessous resterait inatteignable pour un no-op.
    // Un no-op retourne donc 400 sans rien écrire : pas de token_version incrémenté,
    // pas d'invalidation de session, le JWT actuel reste valide.
    const hasChanged = name !== current.name || email !== current.email;
    if (!hasChanged) {
      return res.status(400).json({ message: 'Aucune modification à appliquer.' });
    }

    // Le no-op est écarté ci-dessus : toute écriture est ici une vraie modification
    // (sessionInvalidated = true, token_version incrémenté, anciens JWT invalidés).
    const affected = await User.updateProfile(req.user.id, { name, email }, hasChanged);
    if (affected === 0) {
      return res.status(400).json({ message: 'Aucune modification à appliquer.' });
    }

    // Journal d'audit : ni le mot de passe, ni un token ne sont écrits ici.
    await Log.create(req.user.id, 'UPDATE_PROFILE', `${current.name} a mis à jour son profil`);

    const updated = await User.findById(req.user.id);
    // Réponse sans password / reset_code / token_version.
    res.json({
      message: 'Profil mis à jour avec succès.',
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      // Indique au frontend qu'il doit se reconnecter si l'email a changé.
      sessionInvalidated: hasChanged,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/password (protégé)
// Change le mot de passe du utilisateur connecté.
// Suite à SEC-08, toutes les sessions existantes sont invalidées (token_version + 1) :
// le frontend doit donc se reconnecter après cet appel.
const changePassword = async (req, res, next) => {
  try {
    const body = req.body || {};
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });
    }

    // Message unique : ne révèle rien sur l'existence du compte.
    const invalidMessage = 'Mot de passe actuel incorrect.';

    const user = await User.findAuthByEmail(req.user.email);
    if (!user) {
      return res.status(401).json({ message: invalidMessage });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ message: invalidMessage });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // UPDATE atomique : password + token_version + 1 dans la même instruction.
    const affected = await User.changePassword(user.id, hashedPassword);
    if (affected === 0) {
      return res.status(400).json({ message: 'Impossible de modifier le mot de passe.' });
    }

    // Journal d'audit : aucun mot de passe n'est écrit ici.
    await Log.create(user.id, 'CHANGE_PASSWORD', `${req.user.name} a changé son mot de passe`);

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout, forgotPassword, verifyResetCode, resetPassword, updateProfile, changePassword };
