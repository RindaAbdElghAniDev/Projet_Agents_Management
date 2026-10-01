const Log = require('../models/logModel');

const ACTIONS = [
  'LOGIN', 'LOGOUT',
  'CREATE_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
  'CREATE_DEPARTMENT', 'UPDATE_DEPARTMENT', 'DELETE_DEPARTMENT',
  'CREATE_LEAVE', 'APPROVE_LEAVE', 'REJECT_LEAVE',
  'CREATE_ATTENDANCE', 'UPDATE_ATTENDANCE',
  'UPDATE_PROFILE', 'CHANGE_PASSWORD',
];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/logs?action=&user_id=&page=&limit=
const getLogs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = (page - 1) * limit;

    const action = req.query.action ? String(req.query.action).toUpperCase() : '';
    if (action && !ACTIONS.includes(action)) {
      throw createError('Action invalide', 400);
    }
    const userId = parseInt(req.query.user_id, 10) || null;

    const { records, total } = await Log.findAll({ action, userId }, limit, offset);

    res.json({
      success: true,
      logs: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLogs, ACTIONS };