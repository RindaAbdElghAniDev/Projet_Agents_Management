const Leave = require('../models/leaveModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

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

// Date du jour au format AAAA-MM-JJ (heure du serveur)
const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Fiche agent de l'utilisateur connecté (pour les comptes AGENT)
const getOwnAgent = async (user) => {
  const agent = await Agent.findByUserId(user.id);
  if (!agent) {
    throw createError("Aucune fiche agent n'est liée à votre compte", 403);
  }
  return agent;
};

// GET /api/leaves?agent_id=&status=&page=&limit=
const getLeaves = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (PENDING, APPROVED ou REJECTED)', 400);
    }

    // Qui peut voir quoi ?
    let agentId;
    if (req.user.role === 'ADMIN') {
      agentId = parseInt(req.query.agent_id, 10) || null; // filtre optionnel
    } else {
      // Un AGENT ne voit que SES demandes, quoi qu'il envoie dans l'URL
      const ownAgent = await getOwnAgent(req.user);
      agentId = ownAgent.id;
    }

    const { records, total } = await Leave.findAll({ agentId, status }, limit, offset);

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

    // Un AGENT ne peut lire que sa propre demande
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
    const startDate = String(body.start_date || '').trim();
    const endDate = String(body.end_date || '').trim();
    const reason = String(body.reason || '').trim();

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

    if (await Leave.findOverlap(ownAgent.id, startDate, endDate)) {
      throw createError(
        'Une demande en attente ou approuvée existe déjà sur cette période',
        409
      );
    }

    const id = await Leave.create({
      agent_id: ownAgent.id,
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

module.exports = { getLeaves, getLeaveById, createLeave, reviewLeave };