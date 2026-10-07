const Log = require('../models/logModel');

const ACTIONS = [
  'LOGIN', 'LOGOUT', 'REGISTER',
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
    // Pass 2 (Stabilization) : parsing strict de user_id — même pattern que SEC-22.
    // Absent/vide → null ; entier positif strict → ID ; 0, négatif ou non-integer → 400.
    const rawUserId = String(req.query.user_id ?? '').trim();
    let userId = null;
    if (rawUserId !== '') {
      const parsedUserId = Number(rawUserId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw createError('user_id invalide', 400);
      }
      userId = parsedUserId;
    }

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

module.exports = { getLogs };
