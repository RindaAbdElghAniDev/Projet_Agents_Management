const pool = require('../config/db');

// SEC-12 : plus aucun SELECT * sur la table users.
// findSafeByEmail : projection minimale pour les usages non authentifiants
// (existence du compte, id, auto-liaison compte<->agent). Ne charge jamais
// password, reset_code ni reset_code_expires_at.
const findSafeByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, token_version, created_at FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
};

// SEC-12 : seule projection qui inclut le hash, car bcrypt.compare en a besoin
// (login + changement de mot de passe). Le hash reste utilise en memoire
// uniquement sur ces deux chemins.
const findAuthByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, token_version, password FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
};

const findById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, token_version, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
};

// SEC-08 : incrémente atomiquement la version de session (révocation des JWT).
// L'incrémentation est faite en SQL (et non lue puis incrémentée en JS) afin d'éviter
// toute incrémentation perdue en cas de requêtes concurrentes.
const incrementTokenVersion = async (userId) => {
  const [result] = await pool.execute(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
    [userId]
  );
  return result.affectedRows;
};

const create = async ({ name, email, password, role = 'AGENT' }) => {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, password, role]
  );
  return result.insertId;
};

// Change le mot de passe et efface le code (usage unique)
// ⚠️ Les colonnes reset_code / reset_code_expires_at ne sont plus utilisées depuis le passage
// de la réinitialisation sur password_reset_tokens (cf. passwordResetModel.js).
// Elles restent volontairement présentes en base : leur suppression fera l'objet d'une tâche séparée.
// Le SET ... = NULL est donc inoffensif (no-op sur des colonnes déjà NULL).
const updatePasswordAndClearCode = async (userId, hashedPassword) => {
  await pool.execute(
    'UPDATE users SET password = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?',
    [hashedPassword, userId]
  );
};

// Met à jour le profil (nom + email). L'id, le rôle et le mot de passe ne sont jamais touchés.
// Si `invalidateSession` est vrai, token_version est incrémenté dans le MÊME UPDATE :
// le changement d'email invalide ainsi immédiatement les anciens JWT (SEC-08),
// et le tout reste atomique. Renvoie affectedRows (0 = aucune ligne modifiée).
const updateProfile = async (id, { name, email }, invalidateSession = false) => {
  const [result] = await pool.execute(
    invalidateSession
      ? 'UPDATE users SET name = ?, email = ?, token_version = token_version + 1 WHERE id = ?'
      : 'UPDATE users SET name = ?, email = ? WHERE id = ?',
    invalidateSession ? [name, email, id] : [name, email, id]
  );
  return result.affectedRows;
};

// Change le mot de passe ET invalide les sessions existantes dans un seul UPDATE atomique.
// `currentPassword` n'est jamais journalisé : seul le hash bcrypt est écrit.
const changePassword = async (id, hashedPassword) => {
  const [result] = await pool.execute(
    'UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?',
    [hashedPassword, id]
  );
  return result.affectedRows;
};

module.exports = {
  findSafeByEmail,
  findAuthByEmail,
  findById,
  create,
  incrementTokenVersion,
  updateProfile,
  changePassword,
  updatePasswordAndClearCode,
};
