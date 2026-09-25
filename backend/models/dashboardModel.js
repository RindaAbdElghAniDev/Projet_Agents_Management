const pool = require('../config/db');

// ----- Cartes du Dashboard Admin -----

// Total, actifs, inactifs en une seule requête grâce à SUM(condition)
// SUM(status = 'ACTIVE') : MySQL compte 1 pour chaque ligne où la condition est vraie
const getAgentCounts = async () => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
            SUM(status = 'ACTIVE') AS active,
            SUM(status = 'INACTIVE') AS inactive
     FROM agents`
  );
  return rows[0];
};

const getDepartmentCount = async () => {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM departments');
  return rows[0].total;
};

// Nombre de présences du jour, regroupées par statut
const getTodayAttendanceCounts = async () => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE attendance_date = CURDATE()
     GROUP BY status`
  );
  return rows;
};

const getPendingLeavesCount = async () => {
  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM leaves WHERE status = 'PENDING'"
  );
  return rows[0].total;
};

// ----- Graphiques Admin -----

// Graphique 1 : nombre d'agents par département (LEFT JOIN : garde les départements vides)
const getAgentsByDepartment = async () => {
  const [rows] = await pool.execute(
    `SELECT d.name AS department_name, COUNT(a.id) AS agents_count
     FROM departments d
     LEFT JOIN agents a ON a.department_id = d.id
     GROUP BY d.id, d.name
     ORDER BY d.name ASC`
  );
  return rows;
};

// Graphique 2 : répartition des présences sur les 30 derniers jours
const getAttendanceBreakdown = async () => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY status`
  );
  return rows;
};

// Graphique 3 : nombre de demandes de congé créées, mois par mois (6 derniers mois)
const getLeavesEvolution = async () => {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM leaves
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`
  );
  return rows;
};

// ----- Dashboard Agent (statistiques personnelles) -----

// Présences du mois en cours, regroupées par statut
const getOwnAttendanceStats = async (agentId) => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE agent_id = ? AND attendance_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
     GROUP BY status`,
    [agentId]
  );
  return rows;
};

const getOwnLeavesStats = async (agentId) => {
  const [rows] = await pool.execute(
    'SELECT status, COUNT(*) AS count FROM leaves WHERE agent_id = ? GROUP BY status',
    [agentId]
  );
  return rows;
};

const getOwnRecentAttendance = async (agentId) => {
  const [rows] = await pool.execute(
    `SELECT attendance_date, check_in, check_out, status
     FROM attendance WHERE agent_id = ?
     ORDER BY attendance_date DESC LIMIT 5`,
    [agentId]
  );
  return rows;
};

module.exports = {
  getAgentCounts,
  getDepartmentCount,
  getTodayAttendanceCounts,
  getPendingLeavesCount,
  getAgentsByDepartment,
  getAttendanceBreakdown,
  getLeavesEvolution,
  getOwnAttendanceStats,
  getOwnLeavesStats,
  getOwnRecentAttendance,
};