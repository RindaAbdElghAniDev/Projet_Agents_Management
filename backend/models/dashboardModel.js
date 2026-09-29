const pool = require('../config/db');

// ----- Cartes du Dashboard Admin -----

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

// ----- Graphiques et KPI Admin -----

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

// Répartition des présences sur les `days` derniers jours (aujourd'hui inclus)
const getAttendanceBreakdown = async (days) => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY status`,
    [days - 1]
  );
  return rows;
};

// Même répartition, pour la période équivalente juste avant (comparaison de tendance)
const getPreviousAttendanceBreakdown = async (days) => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND attendance_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY status`,
    [days * 2 - 1, days - 1]
  );
  return rows;
};

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

// Décisions prises sur les congés (hors "en attente"), pour calculer un taux d'approbation
const getLeaveDecisionCounts = async () => {
  const [rows] = await pool.execute(
    "SELECT status, COUNT(*) AS count FROM leaves WHERE status IN ('APPROVED', 'REJECTED') GROUP BY status"
  );
  return rows;
};

// ----- Dashboard Agent -----

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

// Même chose pour le mois précédent (comparaison de tendance)
const getOwnAttendanceStatsPreviousMonth = async (agentId) => {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE agent_id = ?
       AND attendance_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
       AND attendance_date < DATE_FORMAT(CURDATE(), '%Y-%m-01')
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
// Taux de présence par département sur les `days` derniers jours (utilisé uniquement par l'IA)
const getAttendanceRateByDepartment = async (days) => {
  const [rows] = await pool.execute(
    `SELECT d.name AS department_name,
            SUM(att.status IN ('PRESENT', 'LATE')) AS present_like,
            SUM(att.status IN ('PRESENT', 'ABSENT', 'LATE')) AS marked
     FROM departments d
     JOIN agents a ON a.department_id = d.id
     LEFT JOIN attendance att
       ON att.agent_id = a.id AND att.attendance_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY d.id, d.name`,
    [days - 1]
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
  getPreviousAttendanceBreakdown,
  getLeavesEvolution,
  getLeaveDecisionCounts,
  getOwnAttendanceStats,
  getOwnAttendanceStatsPreviousMonth,
  getOwnLeavesStats,
  getOwnRecentAttendance,
  getAttendanceRateByDepartment
};