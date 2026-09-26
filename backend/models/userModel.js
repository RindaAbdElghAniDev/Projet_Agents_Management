const pool = require('../config/db');

// Cherche un utilisateur par email (avec le mot de passe, pour le Login)
const findByEmail = async (email) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

// Cherche un utilisateur par id (SANS le mot de passe)
const findById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
};

// Cherche un utilisateur par id, AVEC le mot de passe (pour vérifier l'ancien mot de passe)
const findByIdWithPassword = async (id) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
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

// Met à jour le nom et l'email d'un utilisateur
const updateProfile = async (id, { name, email }) => {
  const [result] = await pool.execute(
    'UPDATE users SET name = ?, email = ? WHERE id = ?',
    [name, email, id]
  );
  return result.affectedRows;
};

// Met à jour le mot de passe (déjà hashé) d'un utilisateur
const updatePassword = async (id, hashedPassword) => {
  const [result] = await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  return result.affectedRows;
};

module.exports = { findByEmail, findById, findByIdWithPassword, create, updateProfile, updatePassword };