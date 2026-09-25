const express = require('express');
const router = express.Router();
const { getAdminDashboard, getAgentDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

router.get('/admin', protect, authorizeAdmin, getAdminDashboard);
router.get('/agent', protect, getAgentDashboard);

module.exports = router;