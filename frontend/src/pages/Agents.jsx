import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlineDownload,
  HiOutlineUsers,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
} from 'react-icons/hi';
import api from '../services/api';
import { agentSchema } from '../lib/validators';
import { downloadFile } from '../lib/download';
import { getToday } from '../lib/date';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import SortableHeader from '../components/ui/SortableHeader';

const EMPTY_FILTERS = { search: '', department_id: '', status: '', position: '' };

const Agents = () => {
  const [agents, setAgents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'name', sortOrder: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(agentSchema) });

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10, sort_by: sort.sortBy, sort_order: sort.sortOrder };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const res = await api.get('/agents', { params });
      setAgents(res.data.agents);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data.departments);
      } catch (err) {
        toast.error(err.message);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters, sort]);

  const handleSort = (key) => {
    setSort((prev) =>
      prev.sortBy === key
        ? { sortBy: key, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }
        : { sortBy: key, sortOrder: 'asc' }
    );
  };

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

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

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = {};
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      await downloadFile('/agents/export', params, `agents_${getToday()}.csv`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

   const openAdd = () => {
    setEditingAgent(null);
    reset({
      first_name: '', last_name: '', email: '', phone: '', address: '',
      birth_date: '', hire_date: '', department_id: '', position: '', salary: '', status: 'ACTIVE',
      annual_leave_balance: '18',
    });
    setModalOpen(true);
  };

    const openEdit = (agent) => {
    setEditingAgent(agent);
    reset({
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
      annual_leave_balance: String(agent.annual_leave_balance),
    });
    setModalOpen(true);
  };
  const onSubmit = async (data) => {
    try {
      setSaving(true);
      if (editingAgent) {
        await api.put(`/agents/${editingAgent.id}`, data);
        toast.success('Agent modifié avec succès');
      } else {
        await api.post('/agents', data);
        toast.success('Agent ajouté avec succès');
      }
      setModalOpen(false);
      fetchAgents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/agents/${deleteTarget.id}`);
      toast.success('Agent supprimé avec succès');
      setDeleteTarget(null);
      if (agents.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchAgents();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Agents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} agent(s) au total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={HiOutlineDownload} loading={exporting} onClick={handleExport}>
            Exporter
          </Button>
          <Button icon={HiOutlinePlus} onClick={openAdd}>Ajouter un agent</Button>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Nom, prénom ou email"
            icon={HiOutlineSearch}
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
          />
          <Select name="department_id" value={filters.department_id} onChange={handleFilterChange}>
            <option value="">Tous les départements</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </Select>
          <Input placeholder="Poste" name="position" value={filters.position} onChange={handleFilterChange} />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1">Filtrer</Button>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={handleReset}>Réinitialiser</Button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <SortableHeader label="Nom" sortKey="name" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Département" sortKey="department" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Poste" sortKey="position" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Statut" sortKey="status" currentSort={sort} onSort={handleSort} />
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={HiOutlineUsers}
                      title="Aucun agent trouvé"
                      description={hasActiveFilters ? 'Essaie de modifier tes filtres.' : 'Commence par ajouter un agent.'}
                    />
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {agent.last_name} {agent.first_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{agent.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{agent.department_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{agent.position}</td>
                    <td className="px-4 py-3">
                      <Badge color={agent.status === 'ACTIVE' ? 'green' : 'red'}>
                        {agent.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/agents/${agent.id}`}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                          title="Détails"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => openEdit(agent)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-700"
                          title="Modifier"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(agent)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Supprimer"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && agents.length > 0 && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="agents"
              onChange={setPage}
            />
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAgent ? "Modifier l'agent" : 'Ajouter un agent'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Input label="Prénom" error={errors.first_name?.message} {...register('first_name')} />
          <Input label="Nom" error={errors.last_name?.message} {...register('last_name')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Téléphone" error={errors.phone?.message} {...register('phone')} />
          <Input label="Adresse" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
          <Input label="Date de naissance" type="date" error={errors.birth_date?.message} {...register('birth_date')} />
          <Input label="Date d'embauche" type="date" error={errors.hire_date?.message} {...register('hire_date')} />
          <Select label="Département" error={errors.department_id?.message} {...register('department_id')}>
            <option value="">Choisir...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Input label="Poste" error={errors.position?.message} {...register('position')} />
          <Input label="Salaire" type="number" step="0.01" error={errors.salary?.message} {...register('salary')} />
            <Input
            label="Solde de congés annuel (jours)"
            type="number"
            error={errors.annual_leave_balance?.message}
            {...register('annual_leave_balance')}
          />
          <Select label="Statut" error={errors.status?.message} {...register('status')}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </Select>

          <div className="col-span-full mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer l'agent"
        message={
          deleteTarget
            ? `Supprimer définitivement ${deleteTarget.first_name} ${deleteTarget.last_name} ? Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
      />
    </div>
  );
};

export default Agents;