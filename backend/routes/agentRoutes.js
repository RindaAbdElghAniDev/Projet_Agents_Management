const express = require('express');
const router = express.Router();
const {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  exportAgents,
  createMyAgentProfile,
} = require('../controllers/agentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

// Parcours de complétion : doit être déclaré AVANT le `router.use` ci-dessous,
// sinon un compte AGENT sans fiche serait bloqué par authorizeAdmin et ne pourrait
// jamais créer la fiche manquante.
router.post('/me', protect, createMyAgentProfile);

router.use(protect, authorizeAdmin);

router.get('/export', exportAgents);
router.route('/').get(getAgents).post(createAgent);
router.route('/:id').get(getAgentById).put(updateAgent).delete(deleteAgent);

module.exports = router;