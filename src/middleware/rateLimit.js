/**
 * Rate limiting for login/register, to slow down password-guessing
 * (brute-force) attacks and mass account creation.
 *
 * Counts are kept in memory per client IP, which is fine for a single server.
 * Several servers would need a shared store such as Redis.
 */
const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // max requests per IP per window
  standardHeaders: 'draft-8', // send RateLimit-* headers so clients know their quota
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  skip: () => config.isTest, // automated tests send many requests quickly
});

module.exports = { authLimiter };
