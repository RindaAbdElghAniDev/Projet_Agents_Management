const express = require('express');
const router = express.Router();
const { getLeaves, getLeaveById, createLeave, reviewLeave } = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Lecture : tout utilisateur connecté (le controller filtre selon le rôle)
router.get('/', protect, getLeaves);
router.get('/:id', protect, getLeaveById);

// Création : Agent (vérifié dans le controller)
router.post('/', protect, createLeave);

// Traitement : Admin uniquement
router.put('/:id', protect, authorizeAdmin, reviewLeave);

module.exports = router;