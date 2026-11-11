/**
 * Centralised error handling.
 *
 * Express treats a middleware with FOUR arguments (err, req, res, next) as an
 * error handler. Any error thrown in a route (including a rejected promise in
 * an async handler; Express 5 forwards those on its own) ends up here, so every
 * error response has the same JSON shape: { message, details? }.
 */
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

// Runs when no route matched the request.
function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express needs all four params to detect an error handler
function errorHandler(err, req, res, next) {
  // `statusCode` comes from ApiError; `status` is set by Express itself
  // (e.g. 400 for a malformed JSON body).
  const statusCode = err.statusCode || err.status || 500;

  // Hide internal details of unexpected errors from clients.
  const message = statusCode >= 500 && config.isProduction ? 'Internal server error' : err.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { message };
  if (err.details) body.details = err.details;
  // A stack trace helps while developing but must never leak in production.
  if (!config.isProduction && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
