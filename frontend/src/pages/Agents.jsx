import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  birth_date: '',
  hire_date: '',
  department_id: '',
  position: '',
  salary: '',
  status: 'ACTIVE',
};

const EMPTY_FILTERS = { search: '', department_id: '', status: '', position: '' };

const Agents = () => {
  // ----- Données de la liste -----
  const [agents, setAgents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ----- Filtres et pagination -----
  const [filters, setFilters] = useState(EMPTY_FILTERS); // ce que l'utilisateur tape
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS); // ce qui est envoyé
  const [page, setPage] = useState(1);

  // ----- Fenêtre modale (ajout / modification) -----
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // ----- Chargement des données -----
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value; // on n'envoie que les filtres remplis
      });

      const res = await api.get('/agents', { params });
      setAgents(res.data.agents);
      setPagination(res.data.pagination);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Les départements servent au filtre et au formulaire
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data.departments);
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      }
    };
    fetchDepartments();
  }, []);

  // Recharge la liste quand la page ou les filtres appliqués changent
  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  // ----- Recherche et filtres -----
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // une nouvelle recherche repart de la page 1
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // ----- Modale -----
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormServerError('');
    setShowModal(true);
  };

  const openEdit = (agent) => {
    setEditingId(agent.id);
    setForm({
      first_name: agent.first_name,
      last_name: agent.last_name,
      email: agent.email,
      phone: agent.phone || '',
      address: agent.address || '',
      birth_date: agent.birth_date || '',
      hire_date: agent.hire_date,
      department_id: String(agent.department_id),
      position: agent.position,
      salary: String(agent.salary),
      status: agent.status,
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
    if (!form.first_name.trim()) errs.first_name = 'Le prénom est obligatoire';
    if (!form.last_name.trim()) errs.last_name = 'Le nom est obligatoire';
    if (!EMAIL_REGEX.test(form.email.trim())) errs.email = "Format d'email invalide";
    if (!form.hire_date) errs.hire_date = "La date d'embauche est obligatoire";
    if (!form.department_id) errs.department_id = 'Le département est obligatoire';
    if (!form.position.trim()) errs.position = 'Le poste est obligatoire';
    if (form.salary === '' || Number(form.salary) < 0) {
      errs.salary = 'Le salaire doit être un nombre positif';
    }
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormServerError('');

    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/agents/${editingId}`, form);
      } else {
        await api.post('/agents', form);
      }
      setShowModal(false);
      setMessage({
        type: 'success',
        text: editingId ? 'Agent modifié avec succès' : 'Agent ajouté avec succès',
      });
      fetchAgents();
    } catch (err) {
      setFormServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ----- Suppression -----
  const handleDelete = async (agent) => {
    if (!window.confirm(`Supprimer ${agent.first_name} ${agent.last_name} ?`)) return;

    try {
      await api.delete(`/agents/${agent.id}`);
      setMessage({ type: 'success', text: 'Agent supprimé avec succès' });

      // Si on supprime le dernier agent de la page, on recule d'une page
      if (agents.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchAgents();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Petit helper pour éviter de répéter les champs texte du formulaire
  const renderField = (name, label, type = 'text') => (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input id={name} type={type} name={name} value={form[name]} onChange={handleFormChange} />
      {formErrors[name] && <span className="field-error">{formErrors[name]}</span>}
    </div>
  );

  return (
    <div className="panel">
      <div className="page-header">
        <h1>Agents</h1>
        <button className="btn btn-primary btn-auto" onClick={openAdd}>
          + Ajouter un agent
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* ----- Recherche et filtres ----- */}
      <form className="filters" onSubmit={handleSearch}>
        <input
          type="text"
          name="search"
          placeholder="Nom, prénom ou email"
          value={filters.search}
          onChange={handleFilterChange}
        />
        <select name="department_id" value={filters.department_id} onChange={handleFilterChange}>
          <option value="">Tous les départements</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="INACTIVE">Inactif</option>
        </select>
        <input
          type="text"
          name="position"
          placeholder="Poste"
          value={filters.position}
          onChange={handleFilterChange}
        />
        <button type="submit" className="btn btn-primary btn-auto">Rechercher</button>
        <button type="button" className="btn btn-secondary btn-auto" onClick={handleReset}>
          Réinitialiser
        </button>
      </form>

      {/* ----- Tableau ----- */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Département</th>
              <th>Poste</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="table-empty">Chargement...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan="6" className="table-empty">Aucun agent trouvé</td></tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.last_name} {agent.first_name}</td>
                  <td>{agent.email}</td>
                  <td>{agent.department_name}</td>
                  <td>{agent.position}</td>
                  <td>
                    <span className={`badge ${agent.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                      {agent.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="actions">
                    <Link to={`/agents/${agent.id}`} className="btn btn-secondary btn-sm btn-auto">
                      Détails
                    </Link>
                    <button className="btn btn-primary btn-sm btn-auto" onClick={() => openEdit(agent)}>
                      Modifier
                    </button>
                    <button className="btn btn-danger btn-sm btn-auto" onClick={() => handleDelete(agent)}>
                      Supprimer
                    </button>
                  </td>
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
          Page {pagination.page} sur {Math.max(pagination.totalPages, 1)} ({pagination.total} agents)
        </span>
        <button
          className="btn btn-secondary btn-sm btn-auto"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Suivant
        </button>
      </div>

      {/* ----- Modale ajout / modification ----- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? "Modifier l'agent" : 'Ajouter un agent'}</h2>

            {formServerError && <div className="alert alert-error">{formServerError}</div>}

            <form onSubmit={handleSave} noValidate>
              <div className="form-grid">
                {renderField('first_name', 'Prénom')}
                {renderField('last_name', 'Nom')}
                {renderField('email', 'Email', 'email')}
                {renderField('phone', 'Téléphone')}
                {renderField('address', 'Adresse')}
                {renderField('birth_date', 'Date de naissance', 'date')}
                {renderField('hire_date', "Date d'embauche", 'date')}

                <div className="form-group">
                  <label htmlFor="department_id">Département</label>
                  <select
                    id="department_id"
                    name="department_id"
                    value={form.department_id}
                    onChange={handleFormChange}
                  >
                    <option value="">Choisir...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {formErrors.department_id && (
                    <span className="field-error">{formErrors.department_id}</span>
                  )}
                </div>

                {renderField('position', 'Poste')}
                {renderField('salary', 'Salaire', 'number')}

                <div className="form-group">
                  <label htmlFor="status">Statut</label>
                  <select id="status" name="status" value={form.status} onChange={handleFormChange}>
                    <option value="ACTIVE">Actif</option>
                    <option value="INACTIVE">Inactif</option>
                  </select>
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

export default Agents;