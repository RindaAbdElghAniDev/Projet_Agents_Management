import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

const AgentDetails = () => {
  const { id } = useParams(); // l'id dans l'URL : /agents/:id
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await api.get(`/agents/${id}`);
        setAgent(res.data.agent);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
  }, [id]);

  if (loading) return <div className="panel">Chargement...</div>;

  if (error) {
    return (
      <div className="panel">
        <div className="alert alert-error">{error}</div>
        <Link to="/agents">← Retour à la liste</Link>
      </div>
    );
  }

  const details = [
    ['Prénom', agent.first_name],
    ['Nom', agent.last_name],
    ['Email', agent.email],
    ['Téléphone', agent.phone || '-'],
    ['Adresse', agent.address || '-'],
    ['Date de naissance', agent.birth_date || '-'],
    ["Date d'embauche", agent.hire_date],
    ['Département', agent.department_name],
    ['Poste', agent.position],
    ['Salaire', Number(agent.salary).toLocaleString('fr-FR', { minimumFractionDigits: 2 })],
    ['Statut', agent.status === 'ACTIVE' ? 'Actif' : 'Inactif'],
  ];

  return (
    <div className="panel">
      <div className="page-header">
        <h1>{agent.first_name} {agent.last_name}</h1>
        <Link to="/agents" className="btn btn-secondary btn-auto">← Retour</Link>
      </div>

      <div className="details-grid">
        {details.map(([label, value]) => (
          <div key={label} className="detail-item">
            <span className="detail-label">{label}</span>
            <span className="detail-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentDetails;