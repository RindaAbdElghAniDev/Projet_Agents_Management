const pool = require('../config/db');

// Crée un nouveau token de réinitialisation (on stocke le HASH, jamais le token en clair)
const create = async (userId, tokenHash, expiresAt) => {
  const [result] = await pool.execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
  return result.insertId;
};

// Cherche un token valide : existant, non utilisé, non expiré
const findValidByHash = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND used = 0 AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0];
};

// Marque un token comme utilisé : usage unique, ne peut plus jamais servir
const markAsUsed = async (id) => {
  await pool.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [id]);
};

// Invalide tous les anciens tokens en attente d'un utilisateur (avant d'en émettre un nouveau) :
// un seul lien de réinitialisation reste valide à la fois.
const invalidateAllForUser = async (userId) => {
  await pool.execute('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0', [userId]);
};

module.exports = { create, findValidByHash, markAsUsed, invalidateAllForUser };