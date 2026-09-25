const Department = require('../models/departmentModel');
const Log = require('../models/logModel');
const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Convertit et valide :id
const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError('Identifiant invalide', 400);
  }
  return id;
};

// Nettoie et valide les données d'un département
const cleanDepartmentData = (body = {}) => {
  const data = {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim() || null,
  };

  if (!data.name) {
    throw createError('Le nom du département est obligatoire', 400);
  }
  if (data.name.length > 100) {
    throw createError('Le nom ne doit pas dépasser 100 caractères', 400);
  }
  if (data.description && data.description.length > 255) {
    throw createError('La description ne doit pas dépasser 255 caractères', 400);
  }

  return data;
};

// GET /api/departments
const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.findAll();
    res.json({ success: true, departments });
  } catch (error) {
    next(error);
  }
};

// GET /api/departments/:id
const getDepartmentById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const department = await Department.findById(id);
    if (!department) {
      throw createError('Département introuvable', 404);
    }
    res.json({ success: true, department });
  } catch (error) {
    next(error);
  }
};

// POST /api/departments
const createDepartment = async (req, res, next) => {
  try {
    const data = cleanDepartmentData(req.body);

    if (await Department.findByName(data.name)) {
      throw createError('Un département avec ce nom existe déjà', 409);
    }

    const id = await Department.create(data);
    const department = await Department.findById(id);
    await Log.create(req.user.id, 'CREATE_DEPARTMENT', `${req.user.name} a créé le département ${data.name}`);
    res.status(201).json({
      success: true,
      message: 'Département créé avec succès',
      department,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/departments/:id
const updateDepartment = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (!(await Department.findById(id))) {
      throw createError('Département introuvable', 404);
    }

    const data = cleanDepartmentData(req.body);

    // Le nom ne doit pas appartenir à un AUTRE département
    const sameName = await Department.findByName(data.name);
    if (sameName && sameName.id !== id) {
      throw createError('Un département avec ce nom existe déjà', 409);
    }

    await Department.update(id, data);
    const department = await Department.findById(id);
    await Log.create(req.user.id, 'UPDATE_DEPARTMENT', `${req.user.name} a modifié le département ${data.name}`);
    res.json({
      success: true,
      message: 'Département modifié avec succès',
      department,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/departments/:id
const deleteDepartment = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const department = await Department.findById(id);
    if (!department) {
      throw createError('Département introuvable', 404);
    }

    // Règle de gestion : on ne supprime pas un département qui contient des agents
    if (department.agents_count > 0) {
      throw createError(
        `Impossible de supprimer : ${department.agents_count} agent(s) appartiennent encore à ce département`,
        409
      );
    }

    await Department.remove(id);
    await Log.create(req.user.id, 'DELETE_DEPARTMENT', `${req.user.name} a supprimé le département ${department.name}`);
    res.json({ success: true, message: 'Département supprimé avec succès' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};