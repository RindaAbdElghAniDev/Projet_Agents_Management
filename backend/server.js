require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const agentRoutes = require('./routes/agentRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const logRoutes = require('./routes/logRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// ----- Middlewares généraux -----
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// ----- Route de test -----
app.get('/', (req, res) => {
  res.json({ message: 'Agent Management API is running' });
});

// ----- Routes de l'API -----
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ----- Gestion des erreurs (toujours à la fin) -----
app.use(notFound);
app.use(errorHandler);

// ----- Démarrage du serveur -----
const startServer = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connecté');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur :', error.message);
    process.exit(1);
  }
};

startServer();