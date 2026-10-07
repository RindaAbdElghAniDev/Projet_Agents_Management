const express = require('express');
const router = express.Router();
const {
  getAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  exportAttendance,
} = require('../controllers/attendanceController');
const { protect, requireAgentProfile } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

router.get('/export', protect, authorizeAdmin, exportAttendance);

router.get('/', protect, requireAgentProfile, getAttendance);
router.get('/:id', protect, requireAgentProfile, getAttendanceById);

router.post('/', protect, authorizeAdmin, createAttendance);
router.put('/:id', protect, authorizeAdmin, updateAttendance);

module.exports = router;