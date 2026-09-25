const Dashboard = require('../models/dashboardModel');
const Agent = require('../models/agentModel');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Transforme [{status, count}] en {STATUT_A: 0, STATUT_B: 3, ...}
// pour que React n'ait jamais à gérer un statut manquant
const toCountMap = (rows, keys) => {
  const map = {};
  keys.forEach((key) => { map[key] = 0; });
  rows.forEach((row) => { map[row.status] = Number(row.count); });
  return map;
};

// GET /api/dashboard/admin
const getAdminDashboard = async (req, res, next) => {
  try {
    // Les 7 requêtes tournent en parallèle : le temps total = la plus lente d'entre elles
    const [
      agentCounts,
      totalDepartments,
      todayAttendance,
      pendingLeaves,
      agentsByDepartment,
      attendanceBreakdown,
      leavesEvolution,
    ] = await Promise.all([
      Dashboard.getAgentCounts(),
      Dashboard.getDepartmentCount(),
      Dashboard.getTodayAttendanceCounts(),
      Dashboard.getPendingLeavesCount(),
      Dashboard.getAgentsByDepartment(),
      Dashboard.getAttendanceBreakdown(),
      Dashboard.getLeavesEvolution(),
    ]);

    const todayMap = toCountMap(todayAttendance, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const breakdownMap = toCountMap(attendanceBreakdown, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);

    res.json({
      success: true,
      stats: {
        totalAgents: Number(agentCounts.total),
        activeAgents: Number(agentCounts.active) || 0,
        inactiveAgents: Number(agentCounts.inactive) || 0,
        totalDepartments,
        presentToday: todayMap.PRESENT,
        absentToday: todayMap.ABSENT,
        pendingLeaves,
      },
      charts: {
        agentsByDepartment,
        attendanceBreakdown: breakdownMap,
        leavesEvolution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/dashboard/agent
const getAgentDashboard = async (req, res, next) => {
  try {
    const agent = await Agent.findByUserId(req.user.id);
    if (!agent) {
      throw createError("Aucune fiche agent n'est liée à votre compte", 403);
    }

    const [attendanceRows, leaveRows, recentAttendance] = await Promise.all([
      Dashboard.getOwnAttendanceStats(agent.id),
      Dashboard.getOwnLeavesStats(agent.id),
      Dashboard.getOwnRecentAttendance(agent.id),
    ]);

    const attendanceMap = toCountMap(attendanceRows, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const leaveMap = toCountMap(leaveRows, ['PENDING', 'APPROVED', 'REJECTED']);

    res.json({
      success: true,
      stats: {
        presentThisMonth: attendanceMap.PRESENT,
        absentThisMonth: attendanceMap.ABSENT,
        lateThisMonth: attendanceMap.LATE,
        pendingLeaves: leaveMap.PENDING,
        approvedLeaves: leaveMap.APPROVED,
        rejectedLeaves: leaveMap.REJECTED,
      },
      recentAttendance,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboard, getAgentDashboard };