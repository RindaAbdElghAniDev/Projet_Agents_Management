import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiArrowLeft } from 'react-icons/hi';
import api from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';

const AgentDetails = () => {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await api.get(`/agents/${id}`);
        setAgent(res.data.agent);
      } catch (err) {
        setNotFound(true);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
  }, [id]);

  if (notFound) {
    return (
      <Card>
        <p className="text-gray-600 dark:text-gray-300">Cet agent est introuvable.</p>
        <Link
          to="/agents"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
        >
          <HiArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
      </Card>
    );
  }

  const details = agent
    ? [
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
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {agent.first_name} {agent.last_name}
          </h1>
        )}
        <Link to="/agents">
          <Button variant="secondary" icon={HiArrowLeft}>Retour</Button>
        </Link>
      </div>

      <Card>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {label}
                </p>
                <p className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{value}</p>
              </div>
            ))}
            <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Statut
              </p>
              <div className="mt-1">
                <Badge color={agent.status === 'ACTIVE' ? 'green' : 'red'}>
                  {agent.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentDetails;