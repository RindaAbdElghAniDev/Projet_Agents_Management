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

// SEC-17 : lecture verrouillée (SELECT ... FOR UPDATE) à utiliser DANS une transaction.
// Le verrou posé sur la ligne agent sérialise la review d'un congé avec toute écriture
// simultanée du statut agent : impossible d'intercaler un passage à INACTIVE entre la
// lecture du statut et le commit de la review (fermeture du TOCTOU). Comportement
// identique à findById pour les colonnes retournées.
const findByIdForUpdate = async (id, conn = pool) => {
  const [rows] = await conn.execute('SELECT * FROM agents WHERE id = ? FOR UPDATE', [id]);
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
// La garde "AND annual_leave_balance + ? >= 0" empêche le solde de devenir négatif même en
// cas d'approbations concurrentes : l'UPDATE est évalué et appliqué par MySQL en une seule
// opération atomique. Le delta est donc passé deux fois (une fois dans le SET, une fois dans
// la condition). Retourne affectedRows : 0 signifie que le solde était insuffisant.
// conn permet d'executer cette ecriture dans la transaction du controleur (SEC-06 etape 2).
// Par defaut on utilise le pool : le comportement hors transaction est inchange.
const adjustBalance = async (id, delta, conn = pool) => {
  const [result] = await conn.execute(
    'UPDATE agents SET annual_leave_balance = annual_leave_balance + ? WHERE id = ? AND annual_leave_balance + ? >= 0',
    [delta, id, delta]
  );
  return result.affectedRows;
};

// Liste complète (sans pagination), pour l'export CSV. Plafonnée à 5000 lignes par sécurité.
// SEC-14 : projection minimale pour l'export CSV. Ni salary, ni address,
// ni birth_date, ni user_id.
const SELECT_AGENTS_EXPORT = `
  SELECT a.id, a.first_name, a.last_name, a.email, a.phone, a.department_id,
         a.position, a.status, a.hire_date, a.annual_leave_balance,
         d.name AS department_name
  FROM agents a
  JOIN departments d ON a.department_id = d.id
`;

const findAllForExport = async (filters) => {
  const { where, params } = buildWhere(filters);
  const orderBy = buildOrderBy('name', 'asc');
  const [agents] = await pool.query(
    `${SELECT_AGENTS_EXPORT} ${where} ${orderBy} LIMIT 5000`,
    params
  );
  return agents;
};

module.exports = {
  findAll,
  findById,
  findByIdForUpdate,
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