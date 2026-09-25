import { useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY_FORM = { name: '', description: '' };

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ----- Fenêtre modale (ajout / modification) -----
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // ----- Chargement de la liste -----
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/departments');
      setDepartments(res.data.departments);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // ----- Modale -----
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormServerError('');
    setShowModal(true);
  };

  const openEdit = (department) => {
    setEditingId(department.id);
    setForm({
      name: department.name,
      description: department.description || '',
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
    if (!form.name.trim()) {
      errs.name = 'Le nom est obligatoire';
    } else if (form.name.trim().length > 100) {
      errs.name = 'Le nom ne doit pas dépasser 100 caractères';
    }
    if (form.description.trim().length > 255) {
      errs.description = 'La description ne doit pas dépasser 255 caractères';
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
        await api.put(`/departments/${editingId}`, form);
      } else {
        await api.post('/departments', form);
      }
      setShowModal(false);
      setMessage({
        type: 'success',
        text: editingId ? 'Département modifié avec succès' : 'Département ajouté avec succès',
      });
      fetchDepartments();
    } catch (err) {
      setFormServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ----- Suppression -----
  const handleDelete = async (department) => {
    if (!window.confirm(`Supprimer le département « ${department.name} » ?`)) return;

    try {
      await api.delete(`/departments/${department.id}`);
      setMessage({ type: 'success', text: 'Département supprimé avec succès' });
      fetchDepartments();
    } catch (err) {
      // Ex. : « Impossible de supprimer : 3 agent(s) appartiennent encore à ce département »
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="panel">
      <div className="page-header">
        <h1>Départements</h1>
        <button className="btn btn-primary btn-auto" onClick={openAdd}>
          + Ajouter un département
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* ----- Tableau ----- */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Agents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="table-empty">Chargement...</td></tr>
            ) : departments.length === 0 ? (
              <tr><td colSpan="4" className="table-empty">Aucun département</td></tr>
            ) : (
              departments.map((department) => (
                <tr key={department.id}>
                  <td><strong>{department.name}</strong></td>
                  <td>{department.description || '-'}</td>
                  <td>{department.agents_count}</td>
                  <td className="actions">
                    <button
                      className="btn btn-primary btn-sm btn-auto"
                      onClick={() => openEdit(department)}
                    >
                      Modifier
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-auto"
                      onClick={() => handleDelete(department)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ----- Modale ajout / modification ----- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Modifier le département' : 'Ajouter un département'}</h2>

            {formServerError && <div className="alert alert-error">{formServerError}</div>}

            <form onSubmit={handleSave} noValidate>
              <div className="form-group">
                <label htmlFor="name">Nom</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Ex. : Juridique"
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (optionnelle)</label>
                <input
                  id="description"
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Ex. : Service juridique et conformité"
                />
                {formErrors.description && (
                  <span className="field-error">{formErrors.description}</span>
                )}
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

export default Departments;