/**
 * An Error that carries an HTTP status code.
 *
 * Controllers and middleware throw this (e.g. `throw new ApiError(404, 'Job not found')`)
 * and the central error handler in middleware/error.js turns it into a JSON response.
 */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    // Optional extra info, e.g. a list of validation errors.
    this.details = details;
  }
}

module.exports = ApiError;
