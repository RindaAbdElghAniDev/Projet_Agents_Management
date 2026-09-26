import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineDocumentText } from 'react-icons/hi';
import api from '../services/api';
import { LOG_ACTION_LABELS } from '../lib/constants';
import { formatDateTime } from '../lib/date';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

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
      toast.error(err.message);
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Logs d'activité</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} entrée(s)</p>
      </div>

      <Card>
        <form onSubmit={handleFilter} className="mb-5 flex flex-col gap-3 sm:flex-row">
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="sm:max-w-xs">
            <option value="">Toutes les actions</option>
            {Object.entries(LOG_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">Filtrer</Button>
            {appliedAction && <Button type="button" variant="ghost" onClick={handleReset}>Réinitialiser</Button>}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <EmptyState
                      icon={HiOutlineDocumentText}
                      title="Aucun log trouvé"
                      description="Aucune activité enregistrée pour ce filtre."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{log.user_name || 'Compte supprimé'}</td>
                    <td className="px-4 py-3">
                      <Badge color="purple">{LOG_ACTION_LABELS[log.action] || log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && logs.length > 0 && (
          <div className="mt-4">
            <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} label="logs" onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default Logs;