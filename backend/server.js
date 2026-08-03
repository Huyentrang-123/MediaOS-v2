'use strict';

const express = require('express');
const cors    = require('cors');
const config  = require('./config');

const researchRouter = require('./routes/research');

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());

/* Health check */
app.get('/api/health', (_req, res) => {
  const hasKey = !!config.tikhub.apiKey;
  res.json({
    status:    'ok',
    tikhub:    hasKey ? 'configured' : 'missing_api_key',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/research', researchRouter);

/* Generic error handler */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`MediaOS backend running on http://localhost:${config.port}`);
  if (!config.tikhub.apiKey) {
    console.warn('WARNING: TIKHUB_API_KEY is not set. Add it to backend/.env');
  }
});
