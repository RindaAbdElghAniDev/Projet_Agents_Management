const Agent = require('../models/agentModel');
const Department = require('../models/departmentModel');
const User = require('../models/userModel');
const Log = require('../models/logModel');
const Attendance = require('../models/attendanceModel');
const Leave = require('../models/leaveModel');
const { toCSV } = require('../utils/csv');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\s().-]{6,30}$/;
const STATUSES = ['ACTIVE', 'INACTIVE'];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError('Identifiant invalide', 400);
  }
  return id;
};

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
    annual_leave_balance:
      body.annual_leave_balance === '' || body.annual_leave_balance == null
        ? 18
        : Number(body.annual_leave_balance),
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
  // SEC-19 : cohérence des dates agent. Comparaison lexicographique fiable sur AAAA-MM-JJ.
  const todayISO = new Date().toISOString().slice(0, 10);
  if (data.hire_date > todayISO) {
    throw createError("La date d'embauche ne peut pas être dans le futur", 400);
  }
  if (data.birth_date && data.hire_date < data.birth_date) {
    throw createError("La date d'embauche ne peut pas être antérieure à la date de naissance", 400);
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
  if (
    !Number.isFinite(data.annual_leave_balance) ||
    data.annual_leave_balance < 0 ||
    data.annual_leave_balance > 365
  ) {
    throw createError('Le solde de congés doit être un nombre entre 0 et 365', 400);
  }

  return data;
};

// GET /api/agents?search=&department_id=&status=&position=&page=&limit=&sort_by=&sort_order=
const getAgents = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (ACTIVE ou INACTIVE)', 400);
    }

    const sortBy = req.query.sort_by ? String(req.query.sort_by) : 'name';
    if (!Agent.SORT_FIELDS.includes(sortBy)) {
      throw createError('Colonne de tri invalide', 400);
    }
    const sortOrder = req.query.sort_order === 'desc' ? 'desc' : 'asc';

    // Pass 2 (Stabilization) : parsing strict de department_id — même pattern que SEC-22.
    // Absent/vide → null (filtre omis) ; entier positif strict → ID ;
    // 0, négatif ou non-integer (abc, 12abc) → 400 (au lieu d'un silencieux null).
    const rawDepartmentId = String(req.query.department_id ?? '').trim();
    let departmentId = null;
    if (rawDepartmentId !== '') {
      const parsedDepartmentId = Number(rawDepartmentId);
      if (!Number.isInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
        throw createError('department_id invalide', 400);
      }
      departmentId = parsedDepartmentId;
    }

    const filters = {
      search: String(req.query.search || '').trim(),
      departmentId,
      status,
      position: String(req.query.position || '').trim(),
    };

    const { agents, total } = await Agent.findAll(filters, limit, offset, { sortBy, sortOrder });

    res.json({
      success: true,
      agents,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

    const user = await User.findSafeByEmail(data.email);
    data.user_id = user ? user.id : null;

    const agentId = await Agent.create(data);
    const agent = await Agent.findById(agentId);

    await Log.create(
      req.user.id,
      'CREATE_AGENT',
      `${req.user.name} a créé l'agent ${data.first_name} ${data.last_name}`
    );

    res.status(201).json({ success: true, message: 'Agent créé avec succès', agent });
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

    const sameEmail = await Agent.findByEmail(data.email);
    if (sameEmail && sameEmail.id !== id) {
      throw createError('Un agent avec cet email existe déjà', 409);
    }
    if (!(await Department.findById(data.department_id))) {
      throw createError('Département introuvable', 400);
    }

    await Agent.update(id, data);

    // SEC-09 : la fiche vient d'être enregistrée avec son nouvel email. Si elle n'était
    // rattachée à aucun compte et qu'un utilisateur possède désormais cet email, on crée
    // le lien. Un lien existant (user_id non NULL) n'est JAMAIS écrasé, et l'on ne lie que
    // si le compte cible n'est pas déjà rattaché à une autre fiche (UNIQUE(user_id)).
    const updated = await Agent.findById(id);
    if (!updated.user_id) {
      const linkedUser = await User.findSafeByEmail(data.email);
      if (linkedUser) {
        const alreadyLinked = await Agent.findByUserId(linkedUser.id);
        if (!alreadyLinked) {
          await Agent.linkUserByEmail(linkedUser.id, data.email);
        }
      }
    }

    const agent = await Agent.findById(id);

    await Log.create(
      req.user.id,
      'UPDATE_AGENT',
      `${req.user.name} a modifié l'agent ${data.first_name} ${data.last_name}`
    );

    res.json({ success: true, message: 'Agent modifié avec succès', agent });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/agents/:id
const deleteAgent = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const agent = await Agent.findById(id);
    if (!agent) {
      throw createError('Agent introuvable', 404);
    }

    // SEC-10 : les présences et les congés sont supprimés en CASCADE par MySQL.
    // On refuse donc toute suppression physique dès qu'un historique existe, et on
    // propose le statut INACTIVE, qui conserve l'historique (cf. SEC-07).
    const [attendanceCount, leaveCount] = await Promise.all([
      Attendance.countByAgent(id),
      Leave.countByAgent(id),
    ]);

    if (attendanceCount > 0 || leaveCount > 0) {
      throw createError(
        `Impossible de supprimer cet agent : ${attendanceCount} présence(s) et ${leaveCount} congé(s) lui sont rattachés. ` +
          `Passez son statut à INACTIVE pour conserver l'historique.`,
        409
      );
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

// GET /api/agents/export?search=&department_id=&status=&position=
const exportAgents = async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    if (status && !STATUSES.includes(status)) {
      throw createError('Statut invalide (ACTIVE ou INACTIVE)', 400);
    }

    // Pass 2 (Stabilization) : parsing strict de department_id — même pattern que SEC-22.
    // Absent/vide → null (filtre omis) ; entier positif strict → ID ;
    // 0, négatif ou non-integer (abc, 12abc) → 400 (au lieu d'un silencieux null).
    const rawDepartmentId = String(req.query.department_id ?? '').trim();
    let departmentId = null;
    if (rawDepartmentId !== '') {
      const parsedDepartmentId = Number(rawDepartmentId);
      if (!Number.isInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
        throw createError('department_id invalide', 400);
      }
      departmentId = parsedDepartmentId;
    }

    const filters = {
      search: String(req.query.search || '').trim(),
      departmentId,
      status,
      position: String(req.query.position || '').trim(),
    };

    const agents = await Agent.findAllForExport(filters);

    const csv = toCSV(agents, [
      { key: 'last_name', label: 'Nom' },
      { key: 'first_name', label: 'Prénom' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'department_name', label: 'Département' },
      { key: 'position', label: 'Poste' },
      { key: 'status', label: 'Statut' },
      { key: 'hire_date', label: "Date d'embauche" },
      { key: 'annual_leave_balance', label: 'Solde congés (jours)' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agents_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// POST /api/agents/me — le compte AGENT crée sa PROPRE fiche agent.
// Route déclarée AVANT `router.use(protect, authorizeAdmin)` : un compte sans fiche doit
// pouvoir démarrer le parcours de complétion.
// Champs acceptés depuis le client : first_name, last_name, email, phone, address,
// birth_date, hire_date, department_id, position.
// Champs JAMAIS acceptés depuis le client : user_id (toujours req.user.id), salary,
// status, annual_leave_balance — imposés par le backend, ignorés s'ils sont envoyés.
const createMyAgentProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'AGENT') {
      throw createError('Seul un compte AGENT peut créer sa fiche agent', 403);
    }

    // UNIQUE(user_id) en base : on refuse explicitement plutôt que de laisser MySQL échouer.
    if (await Agent.findByUserId(req.user.id)) {
      throw createError('Une fiche agent est déjà liée à votre compte', 409);
    }

    // cleanAgentData valide exactement les mêmes champs que la création par un ADMIN.
    // salary et annual_leave_balance sont injectés ici avec les DEFAULT du schéma
    // (agents.salary DEFAULT 0.00, agents.annual_leave_balance DEFAULT 18) afin de ne
    // pas dépendre d'une valeur envoyée par le client, qui serait ignorée.
    const data = cleanAgentData({ ...req.body, salary: 0, annual_leave_balance: 18 });

    // Identité : la fiche doit appartenir au compte connecté ET porter son e-mail.
    // Sans ce contrôle, un client pourrait rattacher sa fiche à un autre
    // compte via user_id, ou visor un e-mail qui n'est pas le sien.
    if (data.email !== String(req.user.email || '').trim().toLowerCase()) {
      throw createError(
        "L'email de la fiche doit correspondre à celui du compte connecté",
        400
      );
    }

    if (!(await Department.findById(data.department_id))) {
      throw createError('Département introuvable', 400);
    }
    if (await Agent.findByEmail(data.email)) {
      throw createError('Un agent avec cet email existe déjà', 409);
    }

    // Écrase explicitement les champs sensibles après validation.
    const agentId = await Agent.create({
      ...data,
      user_id: req.user.id,       // ← TOUJOURS issu du JWT, jamais du body
      salary: 0,
      status: 'ACTIVE',
      annual_leave_balance: 18,
    });

    // Journal d'audit : après succès uniquement.
    await Log.create(
      req.user.id,
      'CREATE_AGENT',
      `${req.user.name} a créé sa fiche agent ${data.first_name} ${data.last_name}`
    );

    const agent = await Agent.findById(agentId);
    res.status(201).json({ success: true, message: 'Fiche agent créée avec succès', agent });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAgents, getAgentById, createAgent, updateAgent, deleteAgent, exportAgents, createMyAgentProfile };
