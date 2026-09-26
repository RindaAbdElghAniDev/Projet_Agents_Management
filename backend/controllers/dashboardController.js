const Dashboard = require('../models/dashboardModel');
const Agent = require('../models/agentModel');

const ALLOWED_PERIODS = [7, 30, 90];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toCountMap = (rows, keys) => {
  const map = {};
  keys.forEach((key) => { map[key] = 0; });
  rows.forEach((row) => { map[row.status] = Number(row.count); });
  return map;
};

// Taux de présence = (Présent + En retard) / (Présent + Absent + En retard), en %.
// Les jours "En congé" sont exclus : ce ne sont pas des absences non justifiées.
const computeAttendanceRate = (map) => {
  const denominator = map.PRESENT + map.ABSENT + map.LATE;
  if (denominator === 0) return null;
  return Math.round(((map.PRESENT + map.LATE) / denominator) * 1000) / 10;
};

// GET /api/dashboard/admin?period=7|30|90
const getAdminDashboard = async (req, res, next) => {
  try {
    const period = ALLOWED_PERIODS.includes(Number(req.query.period)) ? Number(req.query.period) : 30;

    const [
      agentCounts,
      totalDepartments,
      todayAttendance,
      pendingLeaves,
      agentsByDepartment,
      currentBreakdown,
      previousBreakdown,
      leavesEvolution,
      leaveDecisionCounts,
    ] = await Promise.all([
      Dashboard.getAgentCounts(),
      Dashboard.getDepartmentCount(),
      Dashboard.getTodayAttendanceCounts(),
      Dashboard.getPendingLeavesCount(),
      Dashboard.getAgentsByDepartment(),
      Dashboard.getAttendanceBreakdown(period),
      Dashboard.getPreviousAttendanceBreakdown(period),
      Dashboard.getLeavesEvolution(),
      Dashboard.getLeaveDecisionCounts(),
    ]);

    const todayMap = toCountMap(todayAttendance, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const currentMap = toCountMap(currentBreakdown, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const previousMap = toCountMap(previousBreakdown, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const leaveMap = toCountMap(leaveDecisionCounts, ['APPROVED', 'REJECTED']);

    const attendanceRate = computeAttendanceRate(currentMap);
    const previousAttendanceRate = computeAttendanceRate(previousMap);
    const attendanceRateTrend =
      attendanceRate !== null && previousAttendanceRate !== null
        ? Math.round((attendanceRate - previousAttendanceRate) * 10) / 10
        : null;

    const leaveDenominator = leaveMap.APPROVED + leaveMap.REJECTED;
    const leaveApprovalRate =
      leaveDenominator === 0 ? null : Math.round((leaveMap.APPROVED / leaveDenominator) * 1000) / 10;

    const topDepartments = [...agentsByDepartment]
      .sort((a, b) => b.agents_count - a.agents_count)
      .slice(0, 5);

    res.json({
      success: true,
      period,
      stats: {
        totalAgents: Number(agentCounts.total),
        activeAgents: Number(agentCounts.active) || 0,
        inactiveAgents: Number(agentCounts.inactive) || 0,
        totalDepartments,
        presentToday: todayMap.PRESENT,
        absentToday: todayMap.ABSENT,
        pendingLeaves,
        attendanceRate,
        attendanceRateTrend,
        leaveApprovalRate,
      },
      charts: {
        agentsByDepartment,
        topDepartments,
        attendanceBreakdown: currentMap,
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

    const [attendanceRows, previousAttendanceRows, leaveRows, recentAttendance] = await Promise.all([
      Dashboard.getOwnAttendanceStats(agent.id),
      Dashboard.getOwnAttendanceStatsPreviousMonth(agent.id),
      Dashboard.getOwnLeavesStats(agent.id),
      Dashboard.getOwnRecentAttendance(agent.id),
    ]);

    const attendanceMap = toCountMap(attendanceRows, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const previousMap = toCountMap(previousAttendanceRows, ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    const leaveMap = toCountMap(leaveRows, ['PENDING', 'APPROVED', 'REJECTED']);

    const attendanceRate = computeAttendanceRate(attendanceMap);
    const previousAttendanceRate = computeAttendanceRate(previousMap);
    const attendanceRateTrend =
      attendanceRate !== null && previousAttendanceRate !== null
        ? Math.round((attendanceRate - previousAttendanceRate) * 10) / 10
        : null;

    res.json({
      success: true,
      stats: {
        presentThisMonth: attendanceMap.PRESENT,
        absentThisMonth: attendanceMap.ABSENT,
        lateThisMonth: attendanceMap.LATE,
        pendingLeaves: leaveMap.PENDING,
        approvedLeaves: leaveMap.APPROVED,
        rejectedLeaves: leaveMap.REJECTED,
        attendanceRate,
        attendanceRateTrend,
      },
      recentAttendance,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboard, getAgentDashboard };