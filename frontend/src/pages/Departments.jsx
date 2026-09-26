import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineOfficeBuilding, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import api from '../services/api';
import { departmentSchema } from '../lib/validators';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import SortableHeader from '../components/ui/SortableHeader';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ sortBy: 'name', sortOrder: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(departmentSchema) });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/departments');
      setDepartments(res.data.departments);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSort = (key) => {
    setSort((prev) =>
      prev.sortBy === key
        ? { sortBy: key, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }
        : { sortBy: key, sortOrder: 'asc' }
    );
  };

  // Tri côté client : la liste complète est déjà chargée (pas de pagination pour les départements)
  const sortedDepartments = useMemo(() => {
    const copy = [...departments];
    copy.sort((a, b) => {
      let valA = a[sort.sortBy];
      let valB = b[sort.sortBy];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sort.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sort.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [departments, sort]);

  const openAdd = () => {
    setEditingDept(null);
    reset({ name: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (department) => {
    setEditingDept(department);
    reset({ name: department.name, description: department.description || '' });
    setModalOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, data);
        toast.success('Département modifié avec succès');
      } else {
        await api.post('/departments', data);
        toast.success('Département ajouté avec succès');
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/departments/${deleteTarget.id}`);
      toast.success('Département supprimé avec succès');
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Départements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{departments.length} département(s)</p>
        </div>
        <Button icon={HiOutlinePlus} onClick={openAdd}>Ajouter un département</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <SortableHeader label="Nom" sortKey="name" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Description" sortKey="description" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Agents" sortKey="agents_count" currentSort={sort} onSort={handleSort} />
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedDepartments.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <EmptyState
                      icon={HiOutlineOfficeBuilding}
                      title="Aucun département"
                      description="Commence par en ajouter un."
                    />
                  </td>
                </tr>
              ) : (
                sortedDepartments.map((department) => (
                  <tr key={department.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {department.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {department.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {department.agents_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(department)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-700"
                          title="Modifier"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(department)}
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
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDept ? 'Modifier le département' : 'Ajouter un département'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input label="Nom" error={errors.name?.message} {...register('name')} />
          <Input label="Description (optionnelle)" error={errors.description?.message} {...register('description')} />
          <div className="mt-2 flex justify-end gap-2">
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
        title="Supprimer le département"
        message={deleteTarget ? `Supprimer « ${deleteTarget.name} » ? Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
      />
    </div>
  );
};

export default Departments;