const pool = require('../config/db');

// Chaque présence avec le nom de l'agent et son département (JOIN)
const SELECT_ATTENDANCE = `
  SELECT att.id, att.agent_id, att.attendance_date, att.check_in, att.check_out, att.status,
         a.first_name, a.last_name, d.name AS department_name
  FROM attendance att
  JOIN agents a ON att.agent_id = a.id
  JOIN departments d ON a.department_id = d.id
`;

// WHERE dynamique : le SQL est fixe, les valeurs passent par params (?)
const buildWhere = ({ agentId, status, dateFrom, dateTo }) => {
  const conditions = [];
  const params = [];
 
  if (agentId) {
    conditions.push('att.agent_id = ?');
    params.push(agentId);
  }
  if (status) {
    conditions.push('att.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('att.attendance_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('att.attendance_date <= ?');
    params.push(dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Liste paginée (les plus récentes d'abord) + total
const findAll = async (filters, limit, offset) => {
  const { where, params } = buildWhere(filters);

  const [records] = await pool.query(
    `${SELECT_ATTENDANCE} ${where}
     ORDER BY att.attendance_date DESC, a.last_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM attendance att ${where}`,
    params
  );

  return { records, total: countRows[0].total };
};

// Une présence par id
const findById = async (id) => {
  const [rows] = await pool.execute(`${SELECT_ATTENDANCE} WHERE att.id = ?`, [id]);
  return rows[0];
};

// Une présence pour un agent à une date donnée (pour éviter les doublons)
const findByAgentAndDate = async (agentId, date) => {
  const [rows] = await pool.execute(
    'SELECT id FROM attendance WHERE agent_id = ? AND attendance_date = ?',
    [agentId, date]
  );
  return rows[0];
};

// Créer une présence, retourne son id
const create = async ({ agent_id, attendance_date, check_in, check_out, status }) => {
  const [result] = await pool.execute(
    `INSERT INTO attendance (agent_id, attendance_date, check_in, check_out, status)
     VALUES (?, ?, ?, ?, ?)`,
    [agent_id, attendance_date, check_in, check_out, status]
  );
  return result.insertId;
};

// Modifier le statut et les heures
const update = async (id, { check_in, check_out, status }) => {
  const [result] = await pool.execute(
    'UPDATE attendance SET check_in = ?, check_out = ?, status = ? WHERE id = ?',
    [check_in, check_out, status, id]
  );
  return result.affectedRows;
};
// Liste complète (sans pagination), pour l'export CSV. Plafonnée à 5000 lignes par sécurité.
const findAllForExport = async (filters) => {
  const { where, params } = buildWhere(filters);
  const [records] = await pool.query(
    `${SELECT_ATTENDANCE} ${where} ORDER BY att.attendance_date DESC, a.last_name ASC LIMIT 5000`,
    params
  );
  return records;
};
// Compte les présences rattachées à un agent (SEC-10).
// Lecture seule : sert de garde avant suppression, les FK étant en ON DELETE CASCADE.
const countByAgent = async (id) => {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM attendance WHERE agent_id = ?',
    [id]
  );
  return Number(rows[0].total);
};

module.exports = { findAll, findById, findByAgentAndDate,findAllForExport, create, update, countByAgent };