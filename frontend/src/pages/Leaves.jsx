import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineCalendar, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { leaveSchema } from '../lib/validators';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS, LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS } from '../lib/constants';
import { getToday } from '../lib/date';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';

const Leaves = () => {
  const { isAdmin } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const emptyFilters = isAdmin
    ? { agent_id: '', status: '', leave_type: '' }
    : { status: '', leave_type: '' };
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reviewTarget, setReviewTarget] = useState(null); // { leave, status }
  const [reviewing, setReviewing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(leaveSchema) });

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
      toast.error(err.message);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchAgents = async () => {
      try {
        const res = await api.get('/agents', { params: { limit: 50 } });
        setAgents(res.data.agents);
      } catch (err) {
        toast.error(err.message);
      }
    };
    fetchAgents();
  }, [isAdmin]);
  useEffect(() => {
    if (isAdmin) return;
    const fetchBalance = async () => {
      try {
        const res = await api.get('/leaves/my-balance');
        setBalance(res.data.balance);
      } catch {
        // affichage de confort : une erreur ici ne doit pas bloquer la page
      }
    };
    fetchBalance();
  }, [isAdmin]);

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

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

  const openForm = () => {
    reset({ leave_type: 'PAID', start_date: '', end_date: '', reason: '' });
    setShowForm(true);
  };

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      await api.post('/leaves', data);
      toast.success('Demande de congé envoyée avec succès');
      setShowForm(false);
      fetchLeaves();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    try {
      setReviewing(true);
      await api.put(`/leaves/${reviewTarget.leave.id}`, { status: reviewTarget.status });
      toast.success(reviewTarget.status === 'APPROVED' ? 'Demande approuvée' : 'Demande rejetée');
      setReviewTarget(null);
      fetchLeaves();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const columnCount = isAdmin ? 8 : 4;
  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isAdmin ? 'Demandes de congés' : 'Mes demandes de congé'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} demande(s)</p>
        </div>
              {!isAdmin && (
          <div className="flex items-center gap-3">
            {balance !== null && (
              <Badge color={balance > 0 ? 'blue' : 'red'}>Solde restant : {balance} jour(s)</Badge>
            )}
            <Button icon={HiOutlinePlus} onClick={openForm}>Nouvelle demande</Button>
          </div>
        )}
      </div>

      {showForm && !isAdmin && (
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
            <Select label="Type de congé" error={errors.leave_type?.message} {...register('leave_type')}>
              {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <div />
            <Input label="Date de début" type="date" min={getToday()} error={errors.start_date?.message} {...register('start_date')} />
            <Input label="Date de fin" type="date" min={getToday()} error={errors.end_date?.message} {...register('end_date')} />
            <Input label="Motif" className="sm:col-span-2" error={errors.reason?.message} {...register('reason')} />
            <div className="col-span-full flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button type="submit" loading={saving}>Envoyer la demande</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <form
          onSubmit={handleSearch}
          className={`mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
        >
          {isAdmin && (
            <Select name="agent_id" value={filters.agent_id} onChange={handleFilterChange}>
              <option value="">Tous les agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
              ))}
            </Select>
          )}
          <Select name="leave_type" value={filters.leave_type} onChange={handleFilterChange}>
            <option value="">Tous les types</option>
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Tous les statuts</option>
            {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Filtrer</Button>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" onClick={handleReset}>Réinitialiser</Button>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Agent</th>}
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Département</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Du</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Au</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Motif</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Statut</th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: columnCount }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>
                    <EmptyState
                      icon={HiOutlineCalendar}
                      title="Aucune demande trouvée"
                      description={hasActiveFilters ? 'Essaie de modifier tes filtres.' : 'Aucune demande pour le moment.'}
                    />
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    {isAdmin && <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{leave.last_name} {leave.first_name}</td>}
                    {isAdmin && <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{leave.department_name}</td>}
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{leave.start_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{leave.end_date}</td>
                    <td className="px-4 py-3">
                      <Badge color={LEAVE_TYPE_COLORS[leave.leave_type]}>{LEAVE_TYPE_LABELS[leave.leave_type]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{leave.reason}</td>
                    <td className="px-4 py-3">
                      <Badge color={LEAVE_STATUS_COLORS[leave.status]}>{LEAVE_STATUS_LABELS[leave.status]}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {leave.status === 'PENDING' ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setReviewTarget({ leave, status: 'APPROVED' })}
                              className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
                              title="Approuver"
                            >
                              <HiOutlineCheck className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setReviewTarget({ leave, status: 'REJECTED' })}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                              title="Rejeter"
                            >
                              <HiOutlineX className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-right text-xs text-gray-400">
                            {leave.reviewed_by_name ? `par ${leave.reviewed_by_name}` : '-'}
                          </p>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && leaves.length > 0 && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="demandes"
              onChange={setPage}
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onConfirm={handleReview}
        loading={reviewing}
        variant={reviewTarget?.status === 'APPROVED' ? 'primary' : 'danger'}
        title={reviewTarget?.status === 'APPROVED' ? 'Approuver la demande' : 'Rejeter la demande'}
        message={
          reviewTarget
            ? `${reviewTarget.status === 'APPROVED' ? 'Approuver' : 'Rejeter'} la demande de ${reviewTarget.leave.first_name} ${reviewTarget.leave.last_name} ?`
            : ''
        }
        confirmLabel={reviewTarget?.status === 'APPROVED' ? 'Approuver' : 'Rejeter'}
      />
    </div>
  );
};

export default Leaves;