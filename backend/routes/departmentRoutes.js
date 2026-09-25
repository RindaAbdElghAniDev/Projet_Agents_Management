const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Lecture : tout utilisateur connecté
router.get('/', protect, getDepartments);
router.get('/:id', protect, getDepartmentById);

// Écriture : Admin uniquement
router.post('/', protect, authorizeAdmin, createDepartment);
router.put('/:id', protect, authorizeAdmin, updateDepartment);
router.delete('/:id', protect, authorizeAdmin, deleteDepartment);

module.exports = router;