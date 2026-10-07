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
// NEW-02 : `conn` permet d'exécuter ce contrôle dans la transaction du contrôleur (création
// de congé). Par défaut on utilise le pool : le comportement hors transaction est inchangé.
const findOverlap = async (agentId, startDate, endDate, conn = pool) => {
  const [rows] = await conn.execute(
    `SELECT id FROM leaves
     WHERE agent_id = ?
       AND status IN ('PENDING', 'APPROVED')
       AND start_date <= ? AND end_date >= ?`,
    [agentId, endDate, startDate]
  );
  return rows[0];
};

// Créer une demande, retourne son id
// NEW-02 : `conn` permet d'exécuter cet INSERT dans la transaction du contrôleur.
// Par défaut on utilise le pool : le comportement hors transaction est inchangé.
const create = async ({ agent_id, leave_type, start_date, end_date, reason }, conn = pool) => {
  const [result] = await conn.execute(
    `INSERT INTO leaves (agent_id, leave_type, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [agent_id, leave_type, start_date, end_date, reason]
  );
  return result.insertId;
};

// Traiter une demande : approuver ou rejeter
// La condition "AND status = 'PENDING'" rend l'UPDATE atomique et idempotent : si deux
// approbations concurrentes visent la même demande, une seule renvoie affectedRows = 1,
// l'autre renvoie 0 et le contrôleur répond 409. Sans cela, un check-then-act
// (lecture ligne 200 du contrôleur) laisserait passer deux approbations.
//
// SEC-17 : la clause EXISTS exige en PLUS que la fiche agent soit encore ACTIVE au
// moment exact de l'écriture. Approbation et vérification de statut sont donc une
// seule opération MySQL non dissociable — un agent passé INACTIVE fait échouer l'UPDATE
// (affectedRows = 0) et le contrôleur renvoie 409.
//
// `conn` permet d'exécuter cette écriture dans la transaction du contrôleur (SEC-06 étape 2).
// Par défaut on utilise le pool : le comportement hors transaction est inchangé.
const review = async (id, status, reviewerId, conn = pool) => {
  const [result] = await conn.execute(
    `UPDATE leaves
        SET status = ?, reviewed_by = ?
      WHERE id = ?
        AND status = 'PENDING'
        AND EXISTS (SELECT 1 FROM agents a WHERE a.id = leaves.agent_id AND a.status = 'ACTIVE')`,
    [status, reviewerId, id]
  );
  return result.affectedRows;
};

// Compte les congés rattachés à un agent (SEC-10).
// Lecture seule : sert de garde avant suppression, les FK étant en ON DELETE CASCADE.
const countByAgent = async (id) => {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM leaves WHERE agent_id = ?',
    [id]
  );
  return Number(rows[0].total);
};

module.exports = { findAll, findById, findOverlap, create, review, countByAgent };