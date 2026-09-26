const express = require('express');
const router = express.Router();
const {
  getAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  exportAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

router.get('/export', protect, authorizeAdmin, exportAttendance);

router.get('/', protect, getAttendance);
router.get('/:id', protect, getAttendanceById);

router.post('/', protect, authorizeAdmin, createAttendance);
router.put('/:id', protect, authorizeAdmin, updateAttendance);

module.exports = router;