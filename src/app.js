/**
 * Builds and configures the Express application.
 *
 * This file only creates the app and does NOT start listening on a port.
 * server.js does that. Keeping them separate lets tests (Phase 7) import the
 * app and call it with Supertest without opening a real network port.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// ---- Global middleware (runs on every request, in this order) ----
app.use(helmet()); // sets security-related HTTP headers
app.use(cors({ origin: config.corsOrigins })); // only our frontend may call the API from a browser
app.use(express.json({ limit: '1mb' })); // parses JSON request bodies into req.body
if (!config.isTest) {
  app.use(morgan(config.isProduction ? 'combined' : 'dev')); // request logging
}

// ---- Routes ----
app.use('/health', healthRoutes);
// Feature routes are mounted under /api in later phases, e.g.:
// app.use('/api/auth', authRoutes);
// app.use('/api/jobs', jobRoutes);

// ---- Error handling (must be registered AFTER the routes) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
