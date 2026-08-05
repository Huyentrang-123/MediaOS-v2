'use strict';

const path    = require('path');
const express = require('express');
const config  = require('./config');

const researchRouter = require('./routes/research');
const oembedRouter   = require('./routes/oembed');

const app    = express();
const PUBLIC = path.join(__dirname, '..');

/* Serve all frontend static files (css/, js/, modules/, index.html) */
app.use(express.static(PUBLIC));

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
app.use('/api/oembed',   oembedRouter);

/* Generic error handler */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

/* SPA fallback — serve index.html for any non-API GET */
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`MediaOS running on http://localhost:${config.port}`);
  if (!config.tikhub.apiKey) {
    console.warn('WARNING: TIKHUB_API_KEY is not set');
  }
});
