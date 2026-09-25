const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/logController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Consultation des logs : Admin uniquement
router.get('/', protect, authorizeAdmin, getLogs);

module.exports = router;