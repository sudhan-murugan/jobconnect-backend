/**
 * Authentication middleware: "who is making this request?"
 *
 * Expects the header `Authorization: Bearer <token>`. On success it loads the
 * user and puts it on `req.user` for the next handlers; otherwise it responds 401.
 */
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  // Load the user fresh from the DB rather than trusting the token alone, so a
  // deleted account loses access immediately and role changes apply at once.
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  req.user = user;
  next();
}

module.exports = { authenticate };
