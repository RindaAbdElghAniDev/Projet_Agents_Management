const pool = require('../config/db');

// Chaque log avec le nom de l'utilisateur (LEFT JOIN : user_id peut être NULL après un compte supprimé)
const SELECT_LOGS = `
  SELECT l.id, l.user_id, l.action, l.description, l.created_at, u.name AS user_name
  FROM activity_logs l
  LEFT JOIN users u ON l.user_id = u.id
`;

const buildWhere = ({ action, userId }) => {
  const conditions = [];
  const params = [];

  if (action) {
    conditions.push('l.action = ?');
    params.push(action);
  }
  if (userId) {
    conditions.push('l.user_id = ?');
    params.push(userId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Liste paginée (les plus récents d'abord) + total
const findAll = async (filters, limit, offset) => {
  const { where, params } = buildWhere(filters);

  const [records] = await pool.query(
    `${SELECT_LOGS} ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM activity_logs l ${where}`,
    params
  );

  return { records, total: countRows[0].total };
};

// Enregistre une action. Ne doit JAMAIS faire échouer l'action principale :
// une erreur ici est seulement affichée dans le terminal, jamais renvoyée à l'appelant.
const create = async (userId, action, description) => {
  try {
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
      [userId, action, description]
    );
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du log :", error.message);
  }
};

module.exports = { findAll, create };