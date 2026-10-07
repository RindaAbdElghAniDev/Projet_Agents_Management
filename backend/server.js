require('dotenv').config();

// Garde-fou : refuse de démarrer avec un JWT_SECRET absent, trop court ou manifestement
// faible. Un secret faible permettrait de forger un jeton ADMIN valide et donc de contourner
// entièrement l'authentification. On échoue au démarrage plutôt que de servir en insecurity.
const weak = ['secret', 'changeme', 'remplacez', 'votre-secret', 'example'];

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET est obligatoire.');
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET : 32 caractères minimum.');
}

if (weak.some((w) => process.env.JWT_SECRET.toLowerCase().includes(w))) {
  throw new Error('JWT_SECRET semble être une valeur d’exemple.');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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