import { useEffect, useState } from 'react';
import api, { getStoredUser } from '../services/api';

const STATUS_LABELS = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
};

const EMPTY_FILTERS_ADMIN = { agent_id: '', status: '' };
const EMPTY_FILTERS_AGENT = { status: '' };

const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyForm = () => ({ start_date: '', end_date: '', reason: '' });

const Leaves = () => {
  const user = getStoredUser();
  const isAdmin = user?.role === 'ADMIN';
  const emptyFilters = isAdmin ? EMPTY_FILTERS_ADMIN : EMPTY_FILTERS_AGENT;

  // ----- Données -----
  const [leaves, setLeaves] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ----- Filtres et pagination -----
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  // ----- Formulaire (Agent) -----
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // ----- Chargement -----
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const res = await api.get('/leaves', { params });
      setLeaves(res.data.leaves);
      setPagination(res.data.pagination);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  // Liste des agents pour le filtre (Admin seulement)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAgents = async () => {
      try {
        const res = await api.get('/agents', { params: { limit: 50 } });
        setAgents(res.data.agents);
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      }
    };
    fetchAgents();
  }, [isAdmin]);

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  // ----- Filtres -----
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  // ----- Nouvelle demande (Agent) -----
  const openForm = () => {
    setForm(emptyForm());
    setFormErrors({});
    setFormServerError('');
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const errs = {};
    if (!form.start_date) {
      errs.start_date = 'La date de début est obligatoire';
    } else if (form.start_date < getToday()) {
      errs.start_date = 'La date de début ne peut pas être dans le passé';
    }
    if (!form.end_date) {
      errs.end_date = 'La date de fin est obligatoire';
    } else if (form.start_date && form.end_date < form.start_date) {
      errs.end_date = 'Doit être après la date de début';
    }
    if (!form.reason.trim()) {
      errs.reason = 'Le motif est obligatoire';
    } else if (form.reason.trim().length > 255) {
      errs.reason = 'Le motif ne doit pas dépasser 255 caractères';
    }
    return errs;
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setFormServerError('');

    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSaving(true);
      await api.post('/leaves', form);
      setShowForm(false);
      setMessage({ type: 'success', text: 'Demande de congé envoyée avec succès' });
      fetchLeaves();
    } catch (err) {
      setFormServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ----- Traitement (Admin) -----
  const handleReview = async (leave, status) => {
    const label = status === 'APPROVED' ? 'approuver' : 'rejeter';
    if (!window.confirm(`Confirmer : ${label} la demande de ${leave.first_name} ${leave.last_name} ?`)) {
      return;
    }

    try {
      await api.put(`/leaves/${leave.id}`, { status });
      setMessage({
        type: 'success',
        text: status === 'APPROVED' ? 'Demande approuvée' : 'Demande rejetée',
      });
      fetchLeaves();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const columnCount = isAdmin ? 7 : 3;

  return (
    <div className="panel">
      <div className="page-header">
        <h1>{isAdmin ? 'Demandes de congés' : 'Mes demandes de congé'}</h1>
        {!isAdmin && (
          <button className="btn btn-primary btn-auto" onClick={openForm}>
            + Nouvelle demande
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* ----- Formulaire (Agent) ----- */}
      {showForm && !isAdmin && (
        <form className="inline-form" onSubmit={handleSubmitLeave} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="start_date">Date de début</label>
              <input
                id="start_date"
                type="date"
                name="start_date"
                min={getToday()}
                value={form.start_date}
                onChange={handleFormChange}
              />
              {formErrors.start_date && <span className="field-error">{formErrors.start_date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="end_date">Date de fin</label>
              <input
                id="end_date"
                type="date"
                name="end_date"
                min={form.start_date || getToday()}
                value={form.end_date}
                onChange={handleFormChange}
              />
              {formErrors.end_date && <span className="field-error">{formErrors.end_date}</span>}
            </div>

            <div className="form-group form-group-wide">
              <label htmlFor="reason">Motif</label>
              <input
                id="reason"
                type="text"
                name="reason"
                value={form.reason}
                onChange={handleFormChange}
                placeholder="Ex. : Vacances en famille"
              />
              {formErrors.reason && <span className="field-error">{formErrors.reason}</span>}
            </div>
          </div>

          {formServerError && <div className="alert alert-error">{formServerError}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary btn-auto" onClick={() => setShowForm(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
              {saving ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        </form>
      )}

      {/* ----- Filtres ----- */}
      <form className="filters" onSubmit={handleSearch}>
        {isAdmin && (
          <select name="agent_id" value={filters.agent_id} onChange={handleFilterChange}>
            <option value="">Tous les agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.last_name} {a.first_name}
              </option>
            ))}
          </select>
        )}
        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-auto">Filtrer</button>
        <button type="button" className="btn btn-secondary btn-auto" onClick={handleReset}>
          Réinitialiser
        </button>
      </form>

      {/* ----- Tableau ----- */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {isAdmin && <th>Agent</th>}
              {isAdmin && <th>Département</th>}
              <th>Du</th>
              <th>Au</th>
              <th>Motif</th>
              <th>Statut</th>
              {isAdmin && <th>Traité par</th>}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table-empty">Chargement...</td></tr>
            ) : leaves.length === 0 ? (
              <tr><td colSpan={columnCount} className="table-empty">Aucune demande trouvée</td></tr>
            ) : (
              leaves.map((leave) => (
                <tr key={leave.id}>
                  {isAdmin && <td>{leave.last_name} {leave.first_name}</td>}
                  {isAdmin && <td>{leave.department_name}</td>}
                  <td>{leave.start_date}</td>
                  <td>{leave.end_date}</td>
                  <td>{leave.reason}</td>
                  <td>
                    <span className={`badge badge-${leave.status.toLowerCase()}`}>
                      {STATUS_LABELS[leave.status]}
                    </span>
                  </td>
                  {isAdmin && <td>{leave.reviewed_by_name || '-'}</td>}
                  {isAdmin && (
                    <td className="actions">
                      {leave.status === 'PENDING' ? (
                        <>
                          <button
                            className="btn btn-primary btn-sm btn-auto"
                            onClick={() => handleReview(leave, 'APPROVED')}
                          >
                            Approuver
                          </button>
                          <button
                            className="btn btn-danger btn-sm btn-auto"
                            onClick={() => handleReview(leave, 'REJECTED')}
                          >
                            Rejeter
                          </button>
                        </>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ----- Pagination ----- */}
      <div className="pagination">
        <button
          className="btn btn-secondary btn-sm btn-auto"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Précédent
        </button>
        <span>
          Page {pagination.page} sur {Math.max(pagination.totalPages, 1)} ({pagination.total} demandes)
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

export default Leaves;