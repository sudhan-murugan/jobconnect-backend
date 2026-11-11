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

// Translate well-known library errors into clear HTTP errors.
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose schema validation failed (e.g. a required field is missing)
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(400, 'Validation failed', details);
  }

  // A value couldn't be converted to the schema type, e.g. "/api/jobs/abc" where abc isn't an ObjectId
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid value for ${err.path}`);
  }

  // MongoDB unique index violation (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Value';
    return new ApiError(409, `${field} already exists`);
  }

  return err;
}

// eslint-disable-next-line no-unused-vars -- Express needs all four params to detect an error handler
function errorHandler(err, req, res, next) {
  const error = normalizeError(err);

  // `statusCode` comes from ApiError; `status` is set by Express itself
  // (e.g. 400 for a malformed JSON body).
  const statusCode = error.statusCode || error.status || 500;

  // Hide internal details of unexpected errors from clients.
  const message =
    statusCode >= 500 && config.isProduction ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { message };
  if (error.details) body.details = error.details;
  // A stack trace helps while developing but must never leak in production.
  if (!config.isProduction && statusCode >= 500) body.stack = error.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
