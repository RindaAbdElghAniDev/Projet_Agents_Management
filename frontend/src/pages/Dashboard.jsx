import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import api, { getStoredUser } from '../services/api';

// Enregistre tous les types de graphiques (barres, donut, ligne...) une seule fois
Chart.register(...registerables);

const STATUS_LABELS = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'En retard',
  LEAVE: 'En congé',
};

// ----- Composant générique : un graphique Chart.js sur un <canvas> -----
const ChartBox = ({ type, data, options, title }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // On détruit l'ancien graphique avant d'en recréer un (Chart.js ne se met pas à jour tout seul)
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvasRef.current, { type, data, options });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(data), JSON.stringify(options)]);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="chart-canvas-wrapper">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

// ----- Dashboard Admin -----
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/admin');
        setStats(res.data.stats);
        setCharts(res.data.charts);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <p>Chargement...</p>;

  const departmentChart = {
    labels: charts.agentsByDepartment.map((d) => d.department_name),
    datasets: [
      {
        label: 'Agents',
        data: charts.agentsByDepartment.map((d) => d.agents_count),
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
    ],
  };

  const attendanceChart = {
    labels: Object.keys(charts.attendanceBreakdown).map((key) => STATUS_LABELS[key]),
    datasets: [
      {
        data: Object.values(charts.attendanceBreakdown),
        backgroundColor: ['#16a34a', '#dc2626', '#d97706', '#2563eb'],
      },
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
    <>
      <div className="stats-grid">
        <StatCard label="Total agents" value={stats.totalAgents} />
        <StatCard label="Agents actifs" value={stats.activeAgents} />
        <StatCard label="Agents inactifs" value={stats.inactiveAgents} />
        <StatCard label="Départements" value={stats.totalDepartments} />
        <StatCard label="Présents aujourd'hui" value={stats.presentToday} />
        <StatCard label="Absents aujourd'hui" value={stats.absentToday} />
        <StatCard label="Congés en attente" value={stats.pendingLeaves} />
      </div>

      <div className="charts-grid">
        <ChartBox
          type="bar"
          title="Agents par département"
          data={departmentChart}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          }}
        />
        <ChartBox
          type="doughnut"
          title="Présences / absences (30 derniers jours)"
          data={attendanceChart}
          options={{ responsive: true }}
        />
        <ChartBox
          type="line"
          title="Évolution des demandes de congés"
          data={leavesChart}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          }}
        />
      </div>
    </>
  );
};

// ----- Dashboard Agent -----
const AgentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/agent');
        setStats(res.data.stats);
        setRecent(res.data.recentAttendance);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <p>Chargement...</p>;

  const attendanceChart = {
    labels: ['Présent', 'Absent', 'En retard'],
    datasets: [
      {
        data: [stats.presentThisMonth, stats.absentThisMonth, stats.lateThisMonth],
        backgroundColor: ['#16a34a', '#dc2626', '#d97706'],
      },
    ],
  };

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Présences ce mois-ci" value={stats.presentThisMonth} />
        <StatCard label="Absences ce mois-ci" value={stats.absentThisMonth} />
        <StatCard label="Retards ce mois-ci" value={stats.lateThisMonth} />
        <StatCard label="Congés en attente" value={stats.pendingLeaves} />
        <StatCard label="Congés approuvés" value={stats.approvedLeaves} />
      </div>

      <div className="charts-grid charts-grid-single">
        <ChartBox
          type="doughnut"
          title="Ma présence ce mois-ci"
          data={attendanceChart}
          options={{ responsive: true }}
        />
      </div>

      <div className="panel-section">
        <h3>Présences récentes</h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Arrivée</th>
                <th>Départ</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan="4" className="table-empty">Aucune présence enregistrée</td></tr>
              ) : (
                recent.map((r, index) => (
                  <tr key={index}>
                    <td>{r.attendance_date}</td>
                    <td>{r.check_in ? r.check_in.slice(0, 5) : '-'}</td>
                    <td>{r.check_out ? r.check_out.slice(0, 5) : '-'}</td>
                    <td>
                      <span className={`badge badge-${r.status.toLowerCase()}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ----- Page principale : choisit l'affichage selon le rôle -----
const Dashboard = () => {
  const user = getStoredUser();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="panel">
      <h1>{isAdmin ? 'Dashboard' : 'Mon Dashboard'}</h1>
      {isAdmin ? <AdminDashboard /> : <AgentDashboard />}
    </div>
  );
};

export default Dashboard;