const Leave = require('../models/leaveModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const LEAVE_TYPES = ['PAID', 'SICK', 'MATERNITY_PATERNITY', 'UNPAID'];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError('Identifiant invalide', 400);
  }
  return id;
};

const isValidDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Nombre de jours calendaires couverts par un congé (dates de début et de fin incluses)
const countLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const getOwnAgent = async (user) => {
  const agent = await Agent.findByUserId(user.id);
  if (!agent) {
    throw createError("Aucune fiche agent n'est liée à votre compte", 403);
  }
  return agent;
};

// GET /api/leaves/my-balance (Agent)
const getMyBalance = async (req, res, next) => {
  try {
    const ownAgent = await getOwnAgent(req.user);
    res.json({ success: true, balance: ownAgent.annual_leave_balance });
  } catch (error) {
    next(error);
  }
};

// GET /api/leaves?agent_id=&status=&leave_type=&page=&limit=
const getLeaves = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (PENDING, APPROVED ou REJECTED)', 400);
    }

    const leaveType = req.query.leave_type ? String(req.query.leave_type).toUpperCase() : '';
    if (leaveType && !LEAVE_TYPES.includes(leaveType)) {
      throw createError('Type de congé invalide', 400);
    }

    let agentId;
    if (req.user.role === 'ADMIN') {
      agentId = parseInt(req.query.agent_id, 10) || null;
    } else {
      const ownAgent = await getOwnAgent(req.user);
      agentId = ownAgent.id;
    }

    const { records, total } = await Leave.findAll({ agentId, status, leaveType }, limit, offset);

    res.json({
      success: true,
      leaves: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/leaves/:id
const getLeaveById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const leave = await Leave.findById(id);
    if (!leave) {
      throw createError('Demande introuvable', 404);
    }

    if (req.user.role !== 'ADMIN') {
      const ownAgent = await getOwnAgent(req.user);
      if (leave.agent_id !== ownAgent.id) {
        throw createError('Accès interdit', 403);
      }
    }

    res.json({ success: true, leave });
  } catch (error) {
    next(error);
  }
};

// POST /api/leaves (Agent) : crée une demande pour SA propre fiche
const createLeave = async (req, res, next) => {
  try {
    if (req.user.role !== 'AGENT') {
      throw createError('Seul un agent peut créer une demande de congé', 403);
    }
    const ownAgent = await getOwnAgent(req.user);

    const body = req.body || {};
    const leaveType = String(body.leave_type || '').trim().toUpperCase();
    const startDate = String(body.start_date || '').trim();
    const endDate = String(body.end_date || '').trim();
    const reason = String(body.reason || '').trim();

    if (!LEAVE_TYPES.includes(leaveType)) {
      throw createError('Type de congé invalide', 400);
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw createError('Dates invalides (AAAA-MM-JJ)', 400);
    }
    if (startDate < getToday()) {
      throw createError('La date de début ne peut pas être dans le passé', 400);
    }
    if (endDate < startDate) {
      throw createError('La date de fin doit être après la date de début', 400);
    }
    if (!reason) {
      throw createError('Le motif est obligatoire', 400);
    }
    if (reason.length > 255) {
      throw createError('Le motif ne doit pas dépasser 255 caractères', 400);
    }

    // Un congé PAYÉ ne peut pas dépasser le solde restant de l'agent
    if (leaveType === 'PAID') {
      const requestedDays = countLeaveDays(startDate, endDate);
      if (requestedDays > ownAgent.annual_leave_balance) {
        throw createError(
          `Solde insuffisant : il vous reste ${ownAgent.annual_leave_balance} jour(s), cette demande en compte ${requestedDays}`,
          400
        );
      }
    }

    if (await Leave.findOverlap(ownAgent.id, startDate, endDate)) {
      throw createError('Une demande en attente ou approuvée existe déjà sur cette période', 409);
    }

    const id = await Leave.create({
      agent_id: ownAgent.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
    });
    const leave = await Leave.findById(id);

    await Log.create(
      req.user.id,
      'CREATE_LEAVE',
      `${req.user.name} a demandé un congé du ${startDate} au ${endDate}`
    );

    res.status(201).json({
      success: true,
      message: 'Demande de congé envoyée avec succès',
      leave,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/leaves/:id (Admin) : approuver ou rejeter
const reviewLeave = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const status = String(req.body?.status || '').trim().toUpperCase();
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw createError('Statut invalide (APPROVED ou REJECTED)', 400);
    }

    const leave = await Leave.findById(id);
    if (!leave) {
      throw createError('Demande introuvable', 404);
    }
    if (leave.status !== 'PENDING') {
      throw createError('Cette demande a déjà été traitée', 409);
    }

    // Un congé PAYÉ décompte le solde annuel de l'agent, uniquement au moment de l'approbation
    if (status === 'APPROVED' && leave.leave_type === 'PAID') {
      const agent = await Agent.findById(leave.agent_id);
      const days = countLeaveDays(leave.start_date, leave.end_date);
      if (days > agent.annual_leave_balance) {
        throw createError(
          `Solde insuffisant pour approuver cette demande (${agent.annual_leave_balance} jour(s) restant(s), demande de ${days} jour(s))`,
          409
        );
      }
      await Agent.adjustBalance(leave.agent_id, -days);
    }

    await Leave.review(id, status, req.user.id);
    const updated = await Leave.findById(id);

    await Log.create(
      req.user.id,
      status === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      `${req.user.name} a ${status === 'APPROVED' ? 'approuvé' : 'rejeté'} le congé de ${leave.first_name} ${leave.last_name}`
    );

    res.json({
      success: true,
      message: status === 'APPROVED' ? 'Demande approuvée' : 'Demande rejetée',
      leave: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLeaves, getLeaveById, createLeave, reviewLeave, getMyBalance };