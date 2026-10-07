const express = require('express');
const router = express.Router();
const { getLeaves, getLeaveById, createLeave, reviewLeave, getMyBalance } = require('../controllers/leaveController');
const { protect, requireAgentProfile } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Mon solde de congés (Agent) — déclaré AVANT "/:id" pour ne pas être capturé par ce pattern
router.get('/my-balance', protect, requireAgentProfile, getMyBalance);

router.get('/', protect, requireAgentProfile, getLeaves);
router.get('/:id', protect, requireAgentProfile, getLeaveById);

router.post('/', protect, requireAgentProfile, createLeave);

router.put('/:id', protect, authorizeAdmin, reviewLeave);

module.exports = router;