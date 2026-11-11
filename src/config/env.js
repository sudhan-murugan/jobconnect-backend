/**
 * Centralised configuration.
 *
 * Every setting comes from environment variables (loaded from `.env` in local
 * development). The rest of the codebase imports from this file instead of
 * reading `process.env` directly, so there is one place to see what the app
 * needs and one place where missing values are caught.
 */
const dotenv = require('dotenv');

// `quiet: true` stops dotenv from printing its own log line on every start.
dotenv.config({ quiet: true });

// Fail fast: crash on startup with a clear message rather than failing
// later with a confusing error when the value is first used.
const required = ['MONGODB_URI'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values.'
  );
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  // Comma-separated list of frontend origins allowed to call this API (CORS).
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

config.isProduction = config.nodeEnv === 'production';
config.isTest = config.nodeEnv === 'test';

module.exports = config;
