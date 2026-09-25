const pool = require('../config/db');

// Départements avec le nombre d'agents de chacun
// LEFT JOIN : les départements sans agent apparaissent aussi (avec 0)
const SELECT_DEPARTMENTS = `
  SELECT d.id, d.name, d.description, d.created_at, COUNT(a.id) AS agents_count
  FROM departments d
  LEFT JOIN agents a ON a.department_id = d.id
`;
const GROUP_BY = 'GROUP BY d.id, d.name, d.description, d.created_at';

// Liste de tous les départements
const findAll = async () => {
  const [rows] = await pool.execute(
    `${SELECT_DEPARTMENTS} ${GROUP_BY} ORDER BY d.name ASC`
  );
  return rows;
};

// Un département par id
const findById = async (id) => {
  const [rows] = await pool.execute(
    `${SELECT_DEPARTMENTS} WHERE d.id = ? ${GROUP_BY}`,
    [id]
  );
  return rows[0];
};

// Un département par nom (pour vérifier les doublons)
const findByName = async (name) => {
  const [rows] = await pool.execute(
    'SELECT id FROM departments WHERE name = ?',
    [name]
  );
  return rows[0];
};

// Créer un département, retourne son id
const create = async ({ name, description }) => {
  const [result] = await pool.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [name, description]
  );
  return result.insertId;
};

// Modifier un département
const update = async (id, { name, description }) => {
  const [result] = await pool.execute(
    'UPDATE departments SET name = ?, description = ? WHERE id = ?',
    [name, description, id]
  );
  return result.affectedRows;
};

// Supprimer un département
const remove = async (id) => {
  const [result] = await pool.execute(
    'DELETE FROM departments WHERE id = ?',
    [id]
  );
  return result.affectedRows;
};

module.exports = { findAll, findById, findByName, create, update, remove };