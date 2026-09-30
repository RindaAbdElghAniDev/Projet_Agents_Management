const pool = require('../config/db');

// Chaque demande avec le nom de l'agent, son département et le nom du réviseur
const SELECT_LEAVES = `
  SELECT l.id, l.agent_id, l.leave_type, l.start_date, l.end_date, l.reason, l.status,
         l.reviewed_by, l.created_at,
         a.first_name, a.last_name, d.name AS department_name,
         u.name AS reviewed_by_name
  FROM leaves l
  JOIN agents a ON l.agent_id = a.id
  JOIN departments d ON a.department_id = d.id
  LEFT JOIN users u ON l.reviewed_by = u.id
`;

// WHERE dynamique : le SQL est fixe, les valeurs passent par params (?)
const buildWhere = ({ agentId, status, leaveType }) => {
  const conditions = [];
  const params = [];

  if (agentId) {
    conditions.push('l.agent_id = ?');
    params.push(agentId);
  }
  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }
  if (leaveType) {
    conditions.push('l.leave_type = ?');
    params.push(leaveType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Liste paginée (les plus récentes d'abord) + total
const findAll = async (filters, limit, offset) => {
  const { where, params } = buildWhere(filters);

  const [records] = await pool.query(
    `${SELECT_LEAVES} ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM leaves l ${where}`,
    params
  );

  return { records, total: countRows[0].total };
};

// Une demande par id
const findById = async (id) => {
  const [rows] = await pool.execute(`${SELECT_LEAVES} WHERE l.id = ?`, [id]);
  return rows[0];
};

// Chevauchement de dates pour un agent (peu importe le type : on ne peut pas être sur deux congés en même temps)
const findOverlap = async (agentId, startDate, endDate) => {
  const [rows] = await pool.execute(
    `SELECT id FROM leaves
     WHERE agent_id = ?
       AND status IN ('PENDING', 'APPROVED')
       AND start_date <= ? AND end_date >= ?`,
    [agentId, endDate, startDate]
  );
  return rows[0];
};

// Créer une demande, retourne son id
const create = async ({ agent_id, leave_type, start_date, end_date, reason }) => {
  const [result] = await pool.execute(
    `INSERT INTO leaves (agent_id, leave_type, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [agent_id, leave_type, start_date, end_date, reason]
  );
  return result.insertId;
};

// Traiter une demande : approuver ou rejeter
const review = async (id, status, reviewerId) => {
  const [result] = await pool.execute(
    'UPDATE leaves SET status = ?, reviewed_by = ? WHERE id = ?',
    [status, reviewerId, id]
  );
  return result.affectedRows;
};

module.exports = { findAll, findById, findOverlap, create, review };