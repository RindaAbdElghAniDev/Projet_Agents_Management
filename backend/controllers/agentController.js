const Agent = require('../models/agentModel');
const Department = require('../models/departmentModel');
const User = require('../models/userModel');
const Log = require('../models/logModel');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\s().-]{6,30}$/;
const STATUSES = ['ACTIVE', 'INACTIVE'];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Vérifie le format AAAA-MM-JJ et que la date existe vraiment
const isValidDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

// Convertit et valide :id
const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError('Identifiant invalide', 400);
  }
  return id;
};

// Nettoie et valide les données d'un agent (création et modification)
const cleanAgentData = (body = {}) => {
  const data = {
    first_name: String(body.first_name || '').trim(),
    last_name: String(body.last_name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim() || null,
    address: String(body.address || '').trim() || null,
    birth_date: String(body.birth_date || '').trim() || null,
    hire_date: String(body.hire_date || '').trim(),
    department_id: Number(body.department_id),
    position: String(body.position || '').trim(),
    salary: body.salary === '' || body.salary == null ? NaN : Number(body.salary),
    status: String(body.status || 'ACTIVE').trim().toUpperCase(),
  };

  if (!data.first_name || !data.last_name) {
    throw createError('Le nom et le prénom sont obligatoires', 400);
  }
  if (data.first_name.length > 100 || data.last_name.length > 100) {
    throw createError('Le nom et le prénom ne doivent pas dépasser 100 caractères', 400);
  }
  if (!EMAIL_REGEX.test(data.email)) {
    throw createError("Format d'email invalide", 400);
  }
  if (data.phone && !PHONE_REGEX.test(data.phone)) {
    throw createError('Numéro de téléphone invalide', 400);
  }
  if (data.address && data.address.length > 255) {
    throw createError("L'adresse ne doit pas dépasser 255 caractères", 400);
  }
  if (data.birth_date) {
    if (!isValidDate(data.birth_date)) {
      throw createError('Date de naissance invalide (AAAA-MM-JJ)', 400);
    }
    if (new Date(data.birth_date) > new Date()) {
      throw createError('La date de naissance ne peut pas être dans le futur', 400);
    }
  }
  if (!isValidDate(data.hire_date)) {
    throw createError("Date d'embauche invalide (AAAA-MM-JJ)", 400);
  }
  if (!Number.isInteger(data.department_id) || data.department_id <= 0) {
    throw createError('Le département est obligatoire', 400);
  }
  if (!data.position || data.position.length > 100) {
    throw createError('Le poste est obligatoire (100 caractères maximum)', 400);
  }
  if (!Number.isFinite(data.salary) || data.salary < 0 || data.salary > 99999999.99) {
    throw createError('Le salaire doit être un nombre positif valide', 400);
  }
  if (!STATUSES.includes(data.status)) {
    throw createError('Statut invalide (ACTIVE ou INACTIVE)', 400);
  }

  return data;
};

// GET /api/agents?search=&department_id=&status=&position=&page=&limit=
const getAgents = async (req, res, next) => {
  try {
    // Pagination : valeurs par défaut et bornes
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;

    // Filtres
    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (ACTIVE ou INACTIVE)', 400);
    }

    const filters = {
      search: String(req.query.search || '').trim(),
      departmentId: parseInt(req.query.department_id, 10) || null,
      status,
      position: String(req.query.position || '').trim(),
    };

    const { agents, total } = await Agent.findAll(filters, limit, offset);

    res.json({
      success: true,
      agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/agents/:id
const getAgentById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const agent = await Agent.findById(id);
    if (!agent) {
      throw createError('Agent introuvable', 404);
    }
    res.json({ success: true, agent });
  } catch (error) {
    next(error);
  }
};

// POST /api/agents
const createAgent = async (req, res, next) => {
  try {
    const data = cleanAgentData(req.body);

    if (await Agent.findByEmail(data.email)) {
      throw createError('Un agent avec cet email existe déjà', 409);
    }
    if (!(await Department.findById(data.department_id))) {
      throw createError('Département introuvable', 400);
    }

    // Si un compte de connexion existe avec le même email, on le relie à la fiche
    const user = await User.findByEmail(data.email);
    data.user_id = user ? user.id : null;

    const agentId = await Agent.create(data);
    const agent = await Agent.findById(agentId);
    await Log.create(
      req.user.id,
      'CREATE_AGENT',
      `${req.user.name} a créé l'agent ${data.first_name} ${data.last_name}`
    );
    res.status(201).json({
      success: true,
      message: 'Agent créé avec succès',
      agent,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/agents/:id
const updateAgent = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (!(await Agent.findById(id))) {
      throw createError('Agent introuvable', 404);
    }

    const data = cleanAgentData(req.body);

    // L'email ne doit pas appartenir à un AUTRE agent
    const sameEmail = await Agent.findByEmail(data.email);
    if (sameEmail && sameEmail.id !== id) {
      throw createError('Un agent avec cet email existe déjà', 409);
    }
    if (!(await Department.findById(data.department_id))) {
      throw createError('Département introuvable', 400);
    }

    await Agent.update(id, data);
    const agent = await Agent.findById(id);
    await Log.create(
      req.user.id,
      'UPDATE_AGENT',
      `${req.user.name} a modifié l'agent ${data.first_name} ${data.last_name}`
    );
    res.json({
      success: true,
      message: 'Agent modifié avec succès',
      agent,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/agents/:id
// DELETE /api/agents/:id
const deleteAgent = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const agent = await Agent.findById(id);
    if (!agent) {
      throw createError('Agent introuvable', 404);
    }

    await Agent.remove(id);

    await Log.create(
      req.user.id,
      'DELETE_AGENT',
      `${req.user.name} a supprimé l'agent ${agent.first_name} ${agent.last_name}`
    );

    res.json({ success: true, message: 'Agent supprimé avec succès' });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
};