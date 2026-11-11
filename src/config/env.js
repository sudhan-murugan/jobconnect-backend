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
const required = ['MONGODB_URI', 'JWT_SECRET'];
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

  // Auth
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d', // e.g. "15m", "1d", "7d"
  // bcrypt cost factor: each +1 doubles the time to hash (and to brute-force).
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
};

config.isProduction = config.nodeEnv === 'production';
config.isTest = config.nodeEnv === 'test';

// A short JWT secret can be brute-forced, letting anyone forge login tokens.
if (config.isProduction && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

module.exports = config;
