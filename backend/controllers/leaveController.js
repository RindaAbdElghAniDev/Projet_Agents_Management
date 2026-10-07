const pool = require('../config/db');
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
      // Pass 2 (Stabilization) : parsing strict de agent_id — même pattern que SEC-22.
      // Absent/vide → null (filtre omis) ; entier positif strict → ID ;
      // 0, négatif ou non-integer (abc, 12abc) → 400 (au lieu d'un silencieux null).
      const rawAgentId = String(req.query.agent_id ?? '').trim();
      agentId = null;
      if (rawAgentId !== '') {
        const parsedAgentId = Number(rawAgentId);
        if (!Number.isInteger(parsedAgentId) || parsedAgentId <= 0) {
          throw createError('agent_id invalide', 400);
        }
        agentId = parsedAgentId;
      }
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

// POST /api/leaves (Agent) : crée une demande pour SA propre fiche.
// POLITIQUE MÉTIER SEC-18 : seuls les comptes de rôle AGENT peuvent créer une demande,
// MÊME si un compte ADMIN est exceptionnellement lié à une fiche agents (liens créés par
// linkUserByEmail sans contrôle de rôle). Le refus est délibéré : un ADMIN valideur ne
// doit pas pouvoir saisir lui-même sa propre demande. Placé AVANT getOwnAgent, aucun
// accès à la fiche ni aucune écriture n'a lieu pour un compte non-AGENT.
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

    // NEW-02 : contrôle d'overlap + INSERT sont exécutés dans UNE SEULE transaction (pattern
    // identique à reviewLeave). Point critique : le verrou FOR UPDATE de la fiche agents DOIT
    // être acquis AVANT le premier findOverlap() de la transaction — il sérialise les créations
    // concurrentes du même agent ; sous MySQL REPEATABLE-READ le read view de la lecture
    // d'overlap se crée alors après le commit du concurrent (sinon le TOCTOU réapparaîtrait).
    let connection;
    let id;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 1. Verrou ligne agent : deux créations simultanées de cet agent s'exécutent l'une après l'autre.
      const lockedAgent = await Agent.findByIdForUpdate(ownAgent.id, connection);
      if (!lockedAgent) {
        throw createError('La fiche agent est introuvable', 403);
      }

      // 2. Recontrôle du solde sur la ligne verrouillée (congé PAYÉ).
      if (leaveType === 'PAID') {
        const requestedDays = countLeaveDays(startDate, endDate);
        if (requestedDays > lockedAgent.annual_leave_balance) {
          throw createError(
            `Solde insuffisant : il vous reste ${lockedAgent.annual_leave_balance} jour(s), cette demande en compte ${requestedDays} jour(s)`,
            400
          );
        }
      }

      // 3. Contrôle d'overlap sur la MÊME connexion transactionnelle (après le verrou).
      if (await Leave.findOverlap(ownAgent.id, startDate, endDate, connection)) {
        throw createError('Une demande en attente ou approuvée existe déjà sur cette période', 409);
      }

      // 4. INSERT atomique avec le contrôle.
      id = await Leave.create({
        agent_id: ownAgent.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
      }, connection);

      await connection.commit();
      connection.release();
      connection = null;
    } catch (error) {
      // Annulation : aucune écriture partielle ne doit subsister.
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          process.stdout.write('Rollback impossible : ' + rollbackError.message + '\n');
        }
      }
      next(error);
      return;
    } finally {
      // Libère la connexion du pool dans tous les cas (succès, 409, erreur SQL inattendue).
      if (connection) {
        connection.release();
      }
    }

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
// SEC-06 étape 2 : le débit du solde et le changement de statut sont exécutés dans UNE SEULE
// transaction MySQL (même connexion dédiée). Ainsi il est impossible d'obtenir un solde
// débité alors que la demande reste PENDING, ni l'inverse. En cas d'échec : ROLLBACK.
const reviewLeave = async (req, res, next) => {
  // Connexion réservée à cette transaction : libérée quoi qu'il arrive (voir le finally).
  let connection;
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

    // SEC-17 : congé PAYÉ → le solde n'est contrôlé (et débité) qu'à l'approbation.
    const isPaidApproval = status === 'APPROVED' && leave.leave_type === 'PAID';
    const days = countLeaveDays(leave.start_date, leave.end_date);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // SEC-17 : contrôle métier AVANT tout débit, sur une lecture verrouillée (FOR UPDATE)
    // de la fiche agent dans la transaction. Le verrou ligne sérialise cette review avec
    // toute écriture simultanée de statut agent : impossible d'intercaler un passage à
    // INACTIVE entre la lecture du statut et le commit (fermeture du TOCTOU).
    const agent = await Agent.findByIdForUpdate(leave.agent_id, connection);
    if (!agent) {
      throw createError('Impossible de traiter le congé : fiche agent introuvable.', 409);
    }
    if (agent.status !== 'ACTIVE') {
      throw createError('Impossible de traiter le congé : cet agent est inactif.', 409);
    }

    // Défense applicative (lecture) : donne un message d'erreur précis à l'utilisateur.
    // Défense SQL (l'agentModel) reste seule valable face à une concurrence : c'est
    // l'UPDATE conditionnel qui arbitre réellement en cas d'approbations simultanées.
    if (isPaidApproval && days > agent.annual_leave_balance) {
      throw createError(
        `Solde insuffisant pour approuver cette demande (${agent.annual_leave_balance} jour(s) restant(s), demande de ${days} jour(s))`,
        409
      );
    }

    // 1er écrit : débit du solde (seulement si PAID approuvé)
    if (isPaidApproval) {
      const adjusted = await Agent.adjustBalance(leave.agent_id, -days, connection);
      // 0 ligne affectée = la garde SQL a rejeté le débit (solde insuffisant à l'instant
      // de l'écriture, par exemple à cause d'une approbation concurrente).
      if (adjusted === 0) {
        throw createError('Solde insuffisant pour approuver cette demande', 409);
      }
    }

    // 2e écrit : passage PENDING -> APPROVED/REJECTED
    const reviewed = await Leave.review(id, status, req.user.id, connection);
    // 0 ligne affectée = la demande n'était plus PENDING au moment de l'écriture
    // (traitée entre-temps), ou la garde EXISTS (agent toujours ACTIVE) de Leave.review
    // a rejeté l'UPDATE (SEC-17).
    if (reviewed === 0) {
      const currentAgent = await Agent.findByIdForUpdate(leave.agent_id, connection);
      if (!currentAgent) {
        throw createError('Impossible de traiter le congé : fiche agent introuvable.', 409);
      }
      if (currentAgent.status !== 'ACTIVE') {
        throw createError('Impossible de traiter le congé : cet agent est inactif.', 409);
      }
      throw createError('Cette demande a déjà été traitée', 409);
    }

    await connection.commit();
    connection.release();
    connection = null;

    // Relecture et journalisation APRÈS commit : l'audit n'appartient pas à la transaction.
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
    // Annulation : aucune écriture partielle ne doit subsister.
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        process.stdout.write('Rollback impossible : ' + rollbackError.message + '\n');
      }
    }
    next(error);
  } finally {
    // Libère la connexion du pool dans tous les cas (succès, 409, erreur SQL inattendue).
    if (connection) {
      connection.release();
    }
  }
};

module.exports = { getLeaves, getLeaveById, createLeave, reviewLeave, getMyBalance };