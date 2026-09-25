import { useEffect, useState } from 'react';
import api, { getStoredUser } from '../services/api';

const STATUS_LABELS = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'En retard',
  LEAVE: 'En congé',
};

const EMPTY_FILTERS = { agent_id: '', status: '', date_from: '', date_to: '' };

// Date du jour au format AAAA-MM-JJ (heure locale)
const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "08:30:00" -> "08:30"
const formatTime = (time) => (time ? time.slice(0, 5) : '-');

const emptyForm = () => ({
  agent_id: '',
  attendance_date: getToday(),
  status: 'PRESENT',
  check_in: '',
  check_out: '',
});

const Attendance = () => {
  const user = getStoredUser();
  const isAdmin = user?.role === 'ADMIN';

  // ----- Données -----
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ----- Filtres et pagination -----
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  // ----- Modale (Admin) -----
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null); // null = ajout
  const [form, setForm] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // Pas d'heures pour une absence ou un congé
  const timesDisabled = form.status === 'ABSENT' || form.status === 'LEAVE';

  // ----- Chargement -----
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const res = await api.get('/attendance', { params });
      setRecords(res.data.attendance);
      setPagination(res.data.pagination);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Liste des agents pour le filtre et le formulaire (Admin seulement)
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
    fetchAttendance();
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
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // ----- Modale -----
  const openAdd = () => {
    setEditingRecord(null);
    setForm(emptyForm());
    setFormErrors({});
    setFormServerError('');
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      agent_id: String(record.agent_id),
      attendance_date: record.attendance_date,
      status: record.status,
      check_in: record.check_in ? record.check_in.slice(0, 5) : '',
      check_out: record.check_out ? record.check_out.slice(0, 5) : '',
    });
    setFormErrors({});
    setFormServerError('');
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const errs = {};
    if (!editingRecord) {
      if (!form.agent_id) errs.agent_id = "L'agent est obligatoire";
      if (!form.attendance_date) {
        errs.attendance_date = 'La date est obligatoire';
      } else if (form.attendance_date > getToday()) {
        errs.attendance_date = 'La date ne peut pas être dans le futur';
      }
    }
    if (!timesDisabled) {
      if (!form.check_in) errs.check_in = "L'heure d'arrivée est obligatoire";
      if (form.check_in && form.check_out && form.check_out <= form.check_in) {
        errs.check_out = "Le départ doit être après l'arrivée";
      }
    }
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormServerError('');

    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const details = {
      status: form.status,
      check_in: timesDisabled ? '' : form.check_in,
      check_out: timesDisabled ? '' : form.check_out,
    };

    try {
      setSaving(true);
      if (editingRecord) {
        await api.put(`/attendance/${editingRecord.id}`, details);
      } else {
        await api.post('/attendance', {
          agent_id: form.agent_id,
          attendance_date: form.attendance_date,
          ...details,
        });
      }
      setShowModal(false);
      setMessage({
        type: 'success',
        text: editingRecord ? 'Présence modifiée avec succès' : 'Présence enregistrée avec succès',
      });
      fetchAttendance();
    } catch (err) {
      setFormServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeAgents = agents.filter((a) => a.status === 'ACTIVE');
  const columnCount = isAdmin ? 7 : 4;

  return (
    <div className="panel">
      <div className="page-header">
        <h1>{isAdmin ? 'Présences' : 'Mes présences'}</h1>
        {isAdmin && (
          <button className="btn btn-primary btn-auto" onClick={openAdd}>
            + Enregistrer une présence
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
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
        <label className="filter-field">
          Du
          <input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} />
        </label>
        <label className="filter-field">
          Au
          <input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} />
        </label>
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
              <th>Date</th>
              {isAdmin && <th>Agent</th>}
              {isAdmin && <th>Département</th>}
              <th>Arrivée</th>
              <th>Départ</th>
              <th>Statut</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="table-empty">Chargement...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={columnCount} className="table-empty">Aucune présence trouvée</td></tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{record.attendance_date}</td>
                  {isAdmin && <td>{record.last_name} {record.first_name}</td>}
                  {isAdmin && <td>{record.department_name}</td>}
                  <td>{formatTime(record.check_in)}</td>
                  <td>{formatTime(record.check_out)}</td>
                  <td>
                    <span className={`badge badge-${record.status.toLowerCase()}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="actions">
                      <button
                        className="btn btn-primary btn-sm btn-auto"
                        onClick={() => openEdit(record)}
                      >
                        Modifier
                      </button>
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
          Page {pagination.page} sur {Math.max(pagination.totalPages, 1)} ({pagination.total} présences)
        </span>
        <button
          className="btn btn-secondary btn-sm btn-auto"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Suivant
        </button>
      </div>

      {/* ----- Modale (Admin) ----- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingRecord ? 'Modifier la présence' : 'Enregistrer une présence'}</h2>

            {formServerError && <div className="alert alert-error">{formServerError}</div>}

            {/* En modification, l'agent et la date ne changent pas */}
            {editingRecord && (
              <div className="readonly-info">
                <strong>{editingRecord.last_name} {editingRecord.first_name}</strong>
                {' '}: {editingRecord.attendance_date}
              </div>
            )}

            <form onSubmit={handleSave} noValidate>
              <div className="form-grid">
                {!editingRecord && (
                  <>
                    <div className="form-group">
                      <label htmlFor="agent_id">Agent</label>
                      <select
                        id="agent_id"
                        name="agent_id"
                        value={form.agent_id}
                        onChange={handleFormChange}
                      >
                        <option value="">Choisir...</option>
                        {activeAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.last_name} {a.first_name}
                          </option>
                        ))}
                      </select>
                      {formErrors.agent_id && <span className="field-error">{formErrors.agent_id}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="attendance_date">Date</label>
                      <input
                        id="attendance_date"
                        type="date"
                        name="attendance_date"
                        max={getToday()}
                        value={form.attendance_date}
                        onChange={handleFormChange}
                      />
                      {formErrors.attendance_date && (
                        <span className="field-error">{formErrors.attendance_date}</span>
                      )}
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label htmlFor="status">Statut</label>
                  <select id="status" name="status" value={form.status} onChange={handleFormChange}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="check_in">Heure d'arrivée</label>
                  <input
                    id="check_in"
                    type="time"
                    name="check_in"
                    value={form.check_in}
                    onChange={handleFormChange}
                    disabled={timesDisabled}
                  />
                  {formErrors.check_in && <span className="field-error">{formErrors.check_in}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="check_out">Heure de départ</label>
                  <input
                    id="check_out"
                    type="time"
                    name="check_out"
                    value={form.check_out}
                    onChange={handleFormChange}
                    disabled={timesDisabled}
                  />
                  {formErrors.check_out && <span className="field-error">{formErrors.check_out}</span>}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-auto"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary btn-auto" disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;