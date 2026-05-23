require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

const authRoutes = require('./routes/auth');
const voteRoutes = require('./routes/votes');
const adminRoutes = require('./routes/admin');
const quantumRoutes = require('./routes/quantum');

const app = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}${req.method}\x1b[0m ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quantum', quantumRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'QuantumVote API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    encryption: 'CRYSTALS-Kyber-1024 + AES-256-GCM',
    signature: 'CRYSTALS-Dilithium-3',
    quantumResistant: true,
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Database + Server Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/quantumvote';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('\x1b[36m⚛️  QuantumVote Backend\x1b[0m');
    console.log('\x1b[32m✅ MongoDB connected\x1b[0m');
    server.listen(PORT, () => {
      console.log(`\x1b[32m🚀 Server running on http://localhost:${PORT}\x1b[0m`);
      console.log(`\x1b[33m🔐 PQC: CRYSTALS-Kyber-1024 + Dilithium-3\x1b[0m`);
      console.log(`\x1b[33m🛡️  Quantum-resistant encryption: ACTIVE\x1b[0m\n`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
