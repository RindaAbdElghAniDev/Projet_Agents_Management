const express = require('express');
const router = express.Router();
const { getAdminDashboard, getAgentDashboard, getAiInsights } = require('../controllers/dashboardController');
const { protect, requireAgentProfile } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

router.get('/admin', protect, authorizeAdmin, getAdminDashboard);
router.get('/agent', protect, requireAgentProfile, getAgentDashboard);
router.get('/ai-insights', protect, authorizeAdmin, getAiInsights);

module.exports = router;