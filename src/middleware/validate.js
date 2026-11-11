/**
 * Runs express-validator rules and stops the request with a 400 if any fail.
 *
 * Usage in a route:  router.post('/register', validate(registerRules), register)
 */
const { validationResult, matchedData } = require('express-validator');
const ApiError = require('../utils/ApiError');

function validate(rules) {
  return async (req, res, next) => {
    // Each rule is itself a middleware; run them all so we collect every error at once.
    for (const rule of rules) {
      await rule.run(req);
    }

    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      const details = errors.map((err) => ({ field: err.path, message: err.msg }));
      throw new ApiError(400, 'Validation failed', details);
    }

    // Replace the body with ONLY the validated (and sanitised) fields. Anything
    // extra the client sent, e.g. "passwordHash" or "resumeUrl", is dropped,
    // so controllers can't accidentally save fields users must not set
    // (known as "mass assignment").
    req.body = matchedData(req, { locations: ['body'] });

    // Express 5 re-reads req.query from the URL every time it's accessed, so
    // sanitised values (e.g. page "2" -> 2) can't be written back to it.
    // Controllers read validated query params from req.validatedQuery instead.
    req.validatedQuery = matchedData(req, { locations: ['query'] });

    next();
  };
}

module.exports = { validate };
