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
const swaggerUi = require('swagger-ui-express');

const config = require('./config/env');
const openapiSpec = require('./docs/openapi');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const userRoutes = require('./routes/user.routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// In production the app runs behind the hosting platform's proxy (e.g. Render).
// This makes req.ip the real client IP, which the rate limiter depends on.
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// ---- Global middleware (runs on every request, in this order) ----
app.use(helmet()); // sets security-related HTTP headers
app.use(cors({ origin: config.corsOrigins })); // only our frontend may call the API from a browser
app.use(express.json({ limit: '1mb' })); // parses JSON request bodies into req.body
if (!config.isTest) {
  app.use(morgan(config.isProduction ? 'combined' : 'dev')); // request logging
}

// ---- Routes ----
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);

// ---- API documentation ----
// Interactive docs at /api/docs; the raw spec at /api/docs.json (for tools like Postman).
app.get('/api/docs.json', (req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'JobConnect API Docs',
    swaggerOptions: { persistAuthorization: true }, // keep the token after a page reload
  })
);

// ---- Error handling (must be registered AFTER the routes) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
