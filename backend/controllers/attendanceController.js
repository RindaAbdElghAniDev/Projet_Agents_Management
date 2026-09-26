const Attendance = require('../models/attendanceModel');
const Agent = require('../models/agentModel');
const Log = require('../models/logModel');
const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const { toCSV } = require('../utils/csv');
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

// "08:30" ou "08:30:00" -> "08:30:00" ; vide -> null
const normalizeTime = (value) => {
  const time = String(value || '').trim();
  if (!time) return null;
  if (!TIME_REGEX.test(time)) {
    throw createError('Heure invalide (format HH:MM)', 400);
  }
  return time.length === 5 ? `${time}:00` : time;
};

// Valide le statut et les heures selon les règles de gestion
const cleanAttendanceDetails = (body = {}) => {
  const status = String(body.status || '').trim().toUpperCase();
  if (!STATUSES.includes(status)) {
    throw createError('Statut invalide (PRESENT, ABSENT, LATE ou LEAVE)', 400);
  }

  let checkIn = normalizeTime(body.check_in);
  let checkOut = normalizeTime(body.check_out);

  if (status === 'ABSENT' || status === 'LEAVE') {
    // Pas d'heures pour une absence ou un congé
    checkIn = null;
    checkOut = null;
  } else {
    if (!checkIn) {
      throw createError("L'heure d'arrivée est obligatoire pour ce statut", 400);
    }
    // Les heures sont au format HH:MM:SS : la comparaison de texte fonctionne
    if (checkOut && checkOut <= checkIn) {
      throw createError("L'heure de départ doit être après l'heure d'arrivée", 400);
    }
  }

  return { status, check_in: checkIn, check_out: checkOut };
};

// Fiche agent de l'utilisateur connecté (pour les comptes AGENT)
const getOwnAgent = async (user) => {
  const agent = await Agent.findByUserId(user.id);
  if (!agent) {
    throw createError("Aucune fiche agent n'est liée à votre compte", 403);
  }
  return agent;
};

// GET /api/attendance?agent_id=&status=&date_from=&date_to=&page=&limit=
const getAttendance = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (PRESENT, ABSENT, LATE ou LEAVE)', 400);
    }

    const dateFrom = String(req.query.date_from || '').trim();
    const dateTo = String(req.query.date_to || '').trim();
    if ((dateFrom && !isValidDate(dateFrom)) || (dateTo && !isValidDate(dateTo))) {
      throw createError('Date de filtre invalide (AAAA-MM-JJ)', 400);
    }

    // Qui peut voir quoi ?
    let agentId;
    if (req.user.role === 'ADMIN') {
      agentId = parseInt(req.query.agent_id, 10) || null; // filtre optionnel
    } else {
      // Un AGENT ne voit que SES présences, quoi qu'il envoie dans l'URL
      const ownAgent = await getOwnAgent(req.user);
      agentId = ownAgent.id;
    }

    const { records, total } = await Attendance.findAll(
      { agentId, status, dateFrom, dateTo },
      limit,
      offset
    );

    res.json({
      success: true,
      attendance: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/:id
const getAttendanceById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const record = await Attendance.findById(id);
    if (!record) {
      throw createError('Présence introuvable', 404);
    }

    // Un AGENT ne peut lire que sa propre présence
    if (req.user.role !== 'ADMIN') {
      const ownAgent = await getOwnAgent(req.user);
      if (record.agent_id !== ownAgent.id) {
        throw createError('Accès interdit', 403);
      }
    }

    res.json({ success: true, attendance: record });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance (Admin)
const createAttendance = async (req, res, next) => {
  try {
    const body = req.body || {};

    const agentId = Number(body.agent_id);
    if (!Number.isInteger(agentId) || agentId <= 0) {
      throw createError("L'agent est obligatoire", 400);
    }

    const date = String(body.attendance_date || '').trim();
    if (!isValidDate(date)) {
      throw createError('Date invalide (AAAA-MM-JJ)', 400);
    }
    if (date > getToday()) {
      throw createError('La date ne peut pas être dans le futur', 400);
    }

    const details = cleanAttendanceDetails(body);

    const agent = await Agent.findById(agentId);
    if (!agent) {
      throw createError('Agent introuvable', 400);
    }
    if (agent.status !== 'ACTIVE') {
      throw createError("Impossible d'enregistrer la présence d'un agent inactif", 400);
    }

    if (await Attendance.findByAgentAndDate(agentId, date)) {
      throw createError('La présence de cet agent existe déjà pour cette date', 409);
    }

    const id = await Attendance.create({
      agent_id: agentId,
      attendance_date: date,
      ...details,
    });
    const record = await Attendance.findById(id);

    res.status(201).json({
      success: true,
      message: 'Présence enregistrée avec succès',
      attendance: record,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/attendance/:id (Admin) : modifie le statut et les heures
// PUT /api/attendance/:id (Admin) : modifie le statut et les heures
const updateAttendance = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const existing = await Attendance.findById(id);
    if (!existing) {
      throw createError('Présence introuvable', 404);
    }

    const details = cleanAttendanceDetails(req.body);

    await Attendance.update(id, details);
    const record = await Attendance.findById(id);

    await Log.create(
      req.user.id,
      'UPDATE_ATTENDANCE',
      `${req.user.name} a modifié la présence de ${existing.first_name} ${existing.last_name} du ${existing.attendance_date}`
    );

    res.json({
      success: true,
      message: 'Présence modifiée avec succès',
      attendance: record,
    });
  } catch (error) {
    next(error);
  }
};
// GET /api/attendance/export?agent_id=&status=&date_from=&date_to= (Admin)
const exportAttendance = async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (PRESENT, ABSENT, LATE ou LEAVE)', 400);
    }

    const dateFrom = String(req.query.date_from || '').trim();
    const dateTo = String(req.query.date_to || '').trim();
    if ((dateFrom && !isValidDate(dateFrom)) || (dateTo && !isValidDate(dateTo))) {
      throw createError('Date de filtre invalide (AAAA-MM-JJ)', 400);
    }

    const agentId = parseInt(req.query.agent_id, 10) || null;

    const records = await Attendance.findAllForExport({ agentId, status, dateFrom, dateTo });

    const csv = toCSV(records, [
      { key: 'attendance_date', label: 'Date' },
      { key: 'last_name', label: 'Nom' },
      { key: 'first_name', label: 'Prénom' },
      { key: 'department_name', label: 'Département' },
      { key: 'check_in', label: 'Arrivée' },
      { key: 'check_out', label: 'Départ' },
      { key: 'status', label: 'Statut' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="presences_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
module.exports = { getAttendance, getAttendanceById, createAttendance, updateAttendance, exportAttendance };