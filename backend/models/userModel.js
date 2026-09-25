const pool = require('../config/db');

// Cherche un utilisateur par email (retourne aussi le mot de passe hashé, pour le Login)
const findByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0]; // undefined si aucun résultat
};

// Cherche un utilisateur par id (SANS le mot de passe, utilisé à l'étape 5)
const findById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
};

// Crée un utilisateur et retourne son id
const create = async ({ name, email, password, role = 'AGENT' }) => {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, password, role]
  );
  return result.insertId;
};

module.exports = { findByEmail, findById, create };