'use strict';

const path    = require('path');
const express = require('express');
const config  = require('./config');

const variantsRouter = require('./routes/variants');

const app    = express();
const PUBLIC = path.join(__dirname, '..');

app.use(express.static(PUBLIC));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'browser-assisted', timestamp: new Date().toISOString() });
});

app.use('/api/variants', variantsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`MediaOS running on http://localhost:${config.port}`);
});
