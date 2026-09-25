import { useEffect, useState } from 'react';
import api from '../services/api';

const ACTION_LABELS = {
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  CREATE_AGENT: 'Création agent',
  UPDATE_AGENT: 'Modification agent',
  DELETE_AGENT: 'Suppression agent',
  CREATE_DEPARTMENT: 'Création département',
  UPDATE_DEPARTMENT: 'Modification département',
  DELETE_DEPARTMENT: 'Suppression département',
  CREATE_LEAVE: 'Demande de congé',
  APPROVE_LEAVE: 'Congé approuvé',
  REJECT_LEAVE: 'Congé rejeté',
  UPDATE_ATTENDANCE: 'Modification présence',
};

// "2026-09-21T08:15:30.000Z" -> "21/09/2026 08:15"
const formatDateTime = (value) => {
  const d = new Date(value);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [action, setAction] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (appliedAction) params.action = appliedAction;

      const res = await api.get('/logs', { params });
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedAction]);

  const handleFilter = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedAction(action);
  };

  const handleReset = () => {
    setAction('');
    setAppliedAction('');
    setPage(1);
  };

  return (
    <div className="panel">
      <div className="page-header">
        <h1>Logs d'activité</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="filters" onSubmit={handleFilter}>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-auto">Filtrer</button>
        <button type="button" className="btn btn-secondary btn-auto" onClick={handleReset}>
          Réinitialiser
        </button>
      </form>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="table-empty">Chargement...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4" className="table-empty">Aucun log trouvé</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.user_name || 'Compte supprimé'}</td>
                  <td><span className="badge badge-action">{ACTION_LABELS[log.action] || log.action}</span></td>
                  <td>{log.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="btn btn-secondary btn-sm btn-auto"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Précédent
        </button>
        <span>
          Page {pagination.page} sur {Math.max(pagination.totalPages, 1)} ({pagination.total} logs)
        </span>
        <button
          className="btn btn-secondary btn-sm btn-auto"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default Logs;