import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from '../lib/constants';
import { formatTime } from '../lib/date';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import KpiCard from '../components/ui/KpiCard';
import ChartBox from '../components/ui/ChartBox';
import Select from '../components/ui/Select';
import AiInsightsCard from '../components/ui/AiInsightsCard';

const PERIODS = [
  { value: 7, label: '7 derniers jours' },
  { value: 30, label: '30 derniers jours' },
  { value: 90, label: '90 derniers jours' },
];

const AdminDashboard = () => {
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard/admin', { params: { period } });
        setStats(res.data.stats);
        setCharts(res.data.charts);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const departmentChart = {
    labels: charts.agentsByDepartment.map((d) => d.department_name),
    datasets: [
      { label: 'Agents', data: charts.agentsByDepartment.map((d) => d.agents_count), backgroundColor: '#2563eb', borderRadius: 6 },
    ],
  };

  const attendanceChart = {
    labels: Object.keys(charts.attendanceBreakdown).map((key) => ATTENDANCE_STATUS_LABELS[key]),
    datasets: [
      { data: Object.values(charts.attendanceBreakdown), backgroundColor: ['#16a34a', '#dc2626', '#d97706', '#2563eb'] },
    ],
  };

  const leavesChart = {
    labels: charts.leavesEvolution.map((l) => l.month),
    datasets: [
      {
        label: 'Demandes de congés',
        data: charts.leavesEvolution.map((l) => l.count),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="sm:max-w-xs">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total agents" value={stats.totalAgents} />
        <KpiCard label="Agents actifs" value={stats.activeAgents} />
        <KpiCard label="Départements" value={stats.totalDepartments} />
        <KpiCard label="Congés en attente" value={stats.pendingLeaves} />
        <KpiCard label="Présents aujourd'hui" value={stats.presentToday} />
        <KpiCard label="Absents aujourd'hui" value={stats.absentToday} />
        <KpiCard
          label={`Taux de présence (${period}j)`}
          value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '-'}
          trend={stats.attendanceRateTrend}
        />
        <KpiCard
          label="Taux d'approbation congés"
          value={stats.leaveApprovalRate !== null ? `${stats.leaveApprovalRate}%` : '-'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AiInsightsCard period={period} />

        <ChartBox
          type="bar"
          title="Agents par département"
          data={departmentChart}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          }}
        />
        <ChartBox
          type="doughnut"
          title={`Présences / absences (${period} derniers jours)`}
          data={attendanceChart}
          options={{ responsive: true, maintainAspectRatio: false }}
        />
        <ChartBox
          type="line"
          title="Évolution des demandes de congés"
          data={leavesChart}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          }}
        />
        <Card title="Top départements">
          <ul className="flex flex-col gap-3">
            {charts.topDepartments.map((d) => (
              <li key={d.department_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{d.department_name}</span>
                <Badge color="blue">{d.agents_count} agent(s)</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

const AgentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/agent');
        setStats(res.data.stats);
        setRecent(res.data.recentAttendance);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const attendanceChart = {
    labels: ['Présent', 'Absent', 'En retard'],
    datasets: [
      { data: [stats.presentThisMonth, stats.absentThisMonth, stats.lateThisMonth], backgroundColor: ['#16a34a', '#dc2626', '#d97706'] },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Présences ce mois-ci" value={stats.presentThisMonth} />
        <KpiCard label="Absences ce mois-ci" value={stats.absentThisMonth} />
        <KpiCard label="Retards ce mois-ci" value={stats.lateThisMonth} />
        <KpiCard
          label="Taux de présence"
          value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '-'}
          trend={stats.attendanceRateTrend}
        />
        <KpiCard label="Congés en attente" value={stats.pendingLeaves} />
        <KpiCard label="Congés approuvés" value={stats.approvedLeaves} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartBox
          type="doughnut"
          title="Ma présence ce mois-ci"
          data={attendanceChart}
          options={{ responsive: true, maintainAspectRatio: false }}
        />

        <Card title="Présences récentes">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Arrivée</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Départ</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-2 py-6 text-center text-sm text-gray-400">
                      Aucune présence enregistrée
                    </td>
                  </tr>
                ) : (
                  recent.map((r, index) => (
                    <tr key={index}>
                      <td className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300">{r.attendance_date}</td>
                      <td className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">{formatTime(r.check_in)}</td>
                      <td className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">{formatTime(r.check_out)}</td>
                      <td className="px-2 py-2">
                        <Badge color={ATTENDANCE_STATUS_COLORS[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {isAdmin ? 'Dashboard' : 'Mon Dashboard'}
      </h1>
      {isAdmin ? <AdminDashboard /> : <AgentDashboard />}
    </div>
  );
};

export default Dashboard;