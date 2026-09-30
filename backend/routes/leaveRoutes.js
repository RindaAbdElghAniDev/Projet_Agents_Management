const express = require('express');
const router = express.Router();
const { getLeaves, getLeaveById, createLeave, reviewLeave, getMyBalance } = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Mon solde de congés (Agent) — déclaré AVANT "/:id" pour ne pas être capturé par ce pattern
router.get('/my-balance', protect, getMyBalance);

router.get('/', protect, getLeaves);
router.get('/:id', protect, getLeaveById);

router.post('/', protect, createLeave);

router.put('/:id', protect, authorizeAdmin, reviewLeave);

module.exports = router;