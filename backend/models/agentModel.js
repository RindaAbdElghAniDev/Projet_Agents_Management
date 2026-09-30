const pool = require('../config/db');

const SELECT_AGENTS = `
  SELECT a.*, d.name AS department_name
  FROM agents a
  JOIN departments d ON a.department_id = d.id
`;

const SORT_COLUMNS = {
  name: 'a.last_name',
  email: 'a.email',
  department: 'd.name',
  position: 'a.position',
  salary: 'a.salary',
  hire_date: 'a.hire_date',
  status: 'a.status',
};
const SORT_FIELDS = Object.keys(SORT_COLUMNS);

const buildOrderBy = (sortBy, sortOrder) => {
  const column = SORT_COLUMNS[sortBy] || SORT_COLUMNS.name;
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${column} ${order}`;
};

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

const findAll = async (filters, limit, offset, sort = {}) => {
  const { where, params } = buildWhere(filters);
  const orderBy = buildOrderBy(sort.sortBy, sort.sortOrder);

  const [agents] = await pool.query(
    `${SELECT_AGENTS} ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM agents a ${where}`,
    params
  );

  return { agents, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.execute(`${SELECT_AGENTS} WHERE a.id = ?`, [id]);
  return rows[0];
};

const findByEmail = async (email) => {
  const [rows] = await pool.execute('SELECT id FROM agents WHERE email = ?', [email]);
  return rows[0];
};

// Fiche agent liée à un compte utilisateur (undefined si aucune) — inclut le solde de congés
const findByUserId = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id, first_name, last_name, status, annual_leave_balance FROM agents WHERE user_id = ?',
    [userId]
  );
  return rows[0];
};

const create = async (data) => {
  const [result] = await pool.execute(
    `INSERT INTO agents
      (user_id, department_id, first_name, last_name, email, phone, address,
       birth_date, hire_date, position, salary, status, annual_leave_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.annual_leave_balance,
    ]
  );
  return result.insertId;
};

const update = async (id, data) => {
  const [result] = await pool.execute(
    `UPDATE agents SET
       department_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
       address = ?, birth_date = ?, hire_date = ?, position = ?, salary = ?, status = ?,
       annual_leave_balance = ?
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
      data.annual_leave_balance,
      id,
    ]
  );
  return result.affectedRows;
};

const remove = async (id) => {
  const [result] = await pool.execute('DELETE FROM agents WHERE id = ?', [id]);
  return result.affectedRows;
};

const linkUserByEmail = async (userId, email) => {
  await pool.execute(
    'UPDATE agents SET user_id = ? WHERE email = ? AND user_id IS NULL',
    [userId, email]
  );
};

// Ajuste le solde de congés d'un agent (delta négatif pour décompter, positif pour créditer)
const adjustBalance = async (id, delta) => {
  await pool.execute(
    'UPDATE agents SET annual_leave_balance = annual_leave_balance + ? WHERE id = ?',
    [delta, id]
  );
};

// Liste complète (sans pagination), pour l'export CSV. Plafonnée à 5000 lignes par sécurité.
const findAllForExport = async (filters) => {
  const { where, params } = buildWhere(filters);
  const orderBy = buildOrderBy('name', 'asc');
  const [agents] = await pool.query(`${SELECT_AGENTS} ${where} ${orderBy} LIMIT 5000`, params);
  return agents;
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
  adjustBalance,
  findAllForExport,
  SORT_FIELDS,
};