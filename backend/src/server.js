const express = require('express');
const cors = require('cors');
const { env } = require('./config/environment');
const { connectDatabase } = require('./config/database');
const contextRoutes = require('./routes/context.routes');
const queryRoutes = require('./routes/query.routes');
const incidentRoutes = require('./routes/incident.routes');

const app = express();

app.use(cors({ origin: env.FRONTEND_URLS }));
app.use(express.json());

// Health check
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', status: 'Backend is connected!', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/context', contextRoutes);
app.use('/api/context', queryRoutes);
app.use('/api/context', incidentRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDatabase();
  app.listen(env.PORT, () => {
    console.log(`[server] Running on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err.message);
  process.exit(1);
});
