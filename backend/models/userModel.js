const pool = require('../config/db');

const findByEmail = async (email) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

const findById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
};

const create = async ({ name, email, password, role = 'AGENT' }) => {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, password, role]
  );
  return result.insertId;
};

// Enregistre le code de réinitialisation et sa date d'expiration
const setResetCode = async (email, code, expiresAt) => {
  await pool.execute(
    'UPDATE users SET reset_code = ?, reset_code_expires_at = ? WHERE email = ?',
    [code, expiresAt, email]
  );
};

// Vérifie que le code correspond ET n'est pas expiré, directement dans la requête SQL
const findByValidResetCode = async (email, code) => {
  const [rows] = await pool.execute(
    `SELECT * FROM users
     WHERE email = ? AND reset_code = ? AND reset_code_expires_at > NOW()`,
    [email, code]
  );
  return rows[0];
};

// Change le mot de passe et efface le code (usage unique)
const updatePasswordAndClearCode = async (userId, hashedPassword) => {
  await pool.execute(
    'UPDATE users SET password = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?',
    [hashedPassword, userId]
  );
};

module.exports = {
  findByEmail,
  findById,
  create,
  setResetCode,
  findByValidResetCode,
  updatePasswordAndClearCode,
};