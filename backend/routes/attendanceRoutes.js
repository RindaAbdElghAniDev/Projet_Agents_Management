const express = require('express');
const router = express.Router();
const {
  getAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Lecture : tout utilisateur connecté (le controller filtre selon le rôle)
router.get('/', protect, getAttendance);
router.get('/:id', protect, getAttendanceById);

// Écriture : Admin uniquement
router.post('/', protect, authorizeAdmin, createAttendance);
router.put('/:id', protect, authorizeAdmin, updateAttendance);

module.exports = router;