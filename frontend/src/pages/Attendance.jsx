import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineClipboardCheck, HiOutlinePencil } from 'react-icons/hi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { attendanceCreateSchema, attendanceUpdateSchema } from '../lib/validators';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from '../lib/constants';
import { getToday, formatTime } from '../lib/date';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import { HiOutlineDownload } from 'react-icons/hi';
import { downloadFile } from '../lib/download';
const EMPTY_FILTERS = { agent_id: '', status: '', date_from: '', date_to: '' };

const Attendance = () => {
  const { isAdmin } = useAuth();

  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const modeRef = useRef('create'); // lu par le resolver au moment de la validation

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: (values, context, options) => {
      const schema = modeRef.current === 'edit' ? attendanceUpdateSchema : attendanceCreateSchema;
      return zodResolver(schema)(values, context, options);
    },
  });

  const status = watch('status');
  const timesDisabled = status === 'ABSENT' || status === 'LEAVE';

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
      toast.error(err.message);
      setRecords([]);
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
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

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
    await downloadFile('/attendance/export', params, `presences_${getToday()}.csv`);
  } catch (err) {
    toast.error(err.message);
  } finally {
    setExporting(false);
  }
};
  const openAdd = () => {
    setEditingRecord(null);
    modeRef.current = 'create';
    reset({ agent_id: '', attendance_date: getToday(), status: 'PRESENT', check_in: '', check_out: '' });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    modeRef.current = 'edit';
    reset({
      status: record.status,
      check_in: record.check_in ? record.check_in.slice(0, 5) : '',
      check_out: record.check_out ? record.check_out.slice(0, 5) : '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data) => {
    const details = {
      status: data.status,
      check_in: timesDisabled ? '' : data.check_in,
      check_out: timesDisabled ? '' : data.check_out,
    };

    try {
      setSaving(true);
      if (editingRecord) {
        await api.put(`/attendance/${editingRecord.id}`, details);
        toast.success('Présence modifiée avec succès');
      } else {
        await api.post('/attendance', {
          agent_id: data.agent_id,
          attendance_date: data.attendance_date,
          ...details,
        });
        toast.success('Présence enregistrée avec succès');
      }
      setModalOpen(false);
      fetchAttendance();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeAgents = agents.filter((a) => a.status === 'ACTIVE');
  const columnCount = isAdmin ? 7 : 4;
  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isAdmin ? 'Présences' : 'Mes présences'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} enregistrement(s)</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={HiOutlineDownload} loading={exporting} onClick={handleExport}>
              Exporter
            </Button>
            <Button icon={HiOutlinePlus} onClick={openAdd}>Enregistrer une présence</Button>
          </div>
        )}
      </div>

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
          <Select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Tous les statuts</option>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} />
          <Input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} />
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Agent</th>}
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Département</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Arrivée</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Départ</th>
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
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>
                    <EmptyState
                      icon={HiOutlineClipboardCheck}
                      title="Aucune présence trouvée"
                      description={hasActiveFilters ? 'Essaie de modifier tes filtres.' : 'Aucun enregistrement pour le moment.'}
                    />
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{record.attendance_date}</td>
                    {isAdmin && <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.last_name} {record.first_name}</td>}
                    {isAdmin && <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.department_name}</td>}
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatTime(record.check_in)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatTime(record.check_out)}</td>
                    <td className="px-4 py-3">
                      <Badge color={ATTENDANCE_STATUS_COLORS[record.status]}>{ATTENDANCE_STATUS_LABELS[record.status]}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => openEdit(record)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-700"
                            title="Modifier"
                          >
                            <HiOutlinePencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && records.length > 0 && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="présences"
              onChange={setPage}
            />
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRecord ? 'Modifier la présence' : 'Enregistrer une présence'}
      >
        {editingRecord && (
          <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
            <strong className="text-gray-900 dark:text-gray-100">
              {editingRecord.last_name} {editingRecord.first_name}
            </strong>{' '}
            · {editingRecord.attendance_date}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          {!editingRecord && (
            <>
              <Select label="Agent" error={errors.agent_id?.message} {...register('agent_id')}>
                <option value="">Choisir...</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
                ))}
              </Select>
              <Input
                label="Date"
                type="date"
                max={getToday()}
                error={errors.attendance_date?.message}
                {...register('attendance_date')}
              />
            </>
          )}

          <Select label="Statut" error={errors.status?.message} {...register('status')}>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <div />

          <Input
            label="Heure d'arrivée"
            type="time"
            disabled={timesDisabled}
            error={errors.check_in?.message}
            {...register('check_in')}
          />
          <Input
            label="Heure de départ"
            type="time"
            disabled={timesDisabled}
            error={errors.check_out?.message}
            {...register('check_out')}
          />

          <div className="col-span-full mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Attendance;