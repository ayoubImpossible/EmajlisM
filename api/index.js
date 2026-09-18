'use strict';

// Minimal Vercel serverless entry point
// No complex imports - just a simple Express app to test deployment
const express = require('express');
const app = express();

app.get('/', (_req, res) => {
  res.json({ app: 'eMajlis API', version: '1.0.0', status: 'running' });
});

app.get('/ping', (_req, res) => {
  res.json({ message: 'Hello World 👋', status: 'ok', time: new Date().toISOString() });
});

module.exports = app;
