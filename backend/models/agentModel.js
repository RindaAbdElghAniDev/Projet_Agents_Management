const pool = require('../config/db');

// Requête de base : chaque agent avec le nom de son département (JOIN)
const SELECT_AGENTS = `
  SELECT a.*, d.name AS department_name
  FROM agents a
  JOIN departments d ON a.department_id = d.id
`;

// Construit le WHERE selon les filtres reçus.
// Le SQL ne contient que du texte fixe : les valeurs de l'utilisateur vont TOUJOURS dans params (?)
const buildWhere = ({ search, departmentId, status, position }) => {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (departmentId) {
    conditions.push('a.department_id = ?');
    params.push(departmentId);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (position) {
    conditions.push('a.position LIKE ?');
    params.push(`%${position}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Liste paginée + total
const findAll = async (filters, limit, offset) => {
  const { where, params } = buildWhere(filters);

  // query() plutôt qu'execute() pour LIMIT/OFFSET (voir explication dans le cours)
  const [agents] = await pool.query(
    `${SELECT_AGENTS} ${where} ORDER BY a.last_name ASC, a.first_name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM agents a ${where}`,
    params
  );

  return { agents, total: countRows[0].total };
};

// Un agent par id (avec son département)
const findById = async (id) => {
  const [rows] = await pool.execute(`${SELECT_AGENTS} WHERE a.id = ?`, [id]);
  return rows[0];
};

// Un agent par email (pour vérifier les doublons)
const findByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT id FROM agents WHERE email = ?',
    [email]
  );
  return rows[0];
};

// Créer un agent, retourne son id
const create = async (data) => {
  const [result] = await pool.execute(
    `INSERT INTO agents
      (user_id, department_id, first_name, last_name, email, phone, address,
       birth_date, hire_date, position, salary, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.department_id,
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.address,
      data.birth_date,
      data.hire_date,
      data.position,
      data.salary,
      data.status,
    ]
  );
  return result.insertId;
};

// Modifier un agent
const update = async (id, data) => {
  const [result] = await pool.execute(
    `UPDATE agents SET
       department_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
       address = ?, birth_date = ?, hire_date = ?, position = ?, salary = ?, status = ?
     WHERE id = ?`,
    [
      data.department_id,
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.address,
      data.birth_date,
      data.hire_date,
      data.position,
      data.salary,
      data.status,
      id,
    ]
  );
  return result.affectedRows;
};

// Supprimer un agent
const remove = async (id) => {
  const [result] = await pool.execute('DELETE FROM agents WHERE id = ?', [id]);
  return result.affectedRows;
};

// Relie un compte utilisateur à la fiche agent ayant le même email (si pas déjà reliée)
const linkUserByEmail = async (userId, email) => {
  await pool.execute(
    'UPDATE agents SET user_id = ? WHERE email = ? AND user_id IS NULL',
    [userId, email]
  );
};
// Fiche agent liée à un compte utilisateur (undefined si aucune)
const findByUserId = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id, first_name, last_name, status FROM agents WHERE user_id = ?',
    [userId]
  );
  return rows[0];
};
module.exports = {
  findAll,
  findById,
  findByEmail,
  findByUserId,
  create,
  update,
  remove,
  linkUserByEmail,
};