require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const agentRoutes = require('./routes/agentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const logRoutes = require('./routes/logRoutes');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// En-têtes de sécurité HTTP (CSP, X-Frame-Options, HSTS, suppression de X-Powered-By...)
// Placé en tête de chaîne pour que toutes les réponses, y compris celles du routeur,
// en soient équipées.
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));

app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`📩 ${req.method} ${req.url}`);
  next();
});

// Test API
app.get('/', (req, res) => {
  res.json({
    message: 'Agent Management System API opérationnelle'
  });
});

// ==================== ROUTES ====================

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/logs', logRoutes);

// ==================== ERROR HANDLING ====================
// IMPORTANT : خاصهم يكونو فالآخر

app.use(notFound);
app.use(errorHandler);

// ==================== SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});