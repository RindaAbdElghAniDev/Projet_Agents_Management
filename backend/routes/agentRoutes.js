const express = require('express');
const router = express.Router();
const {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  exportAgents,
} = require('../controllers/agentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/roleMiddleware');

router.use(protect, authorizeAdmin);

router.get('/export', exportAgents);
router.route('/').get(getAgents).post(createAgent);
router.route('/:id').get(getAgentById).put(updateAgent).delete(deleteAgent);

module.exports = router;