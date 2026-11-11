/**
 * Role-based access control: "is this user ALLOWED to do this?"
 *
 * authorize() is a middleware *factory*: it takes the allowed roles and
 * returns a middleware function. Always use it after `authenticate`:
 *
 *   router.post('/', authenticate, authorize(ROLES.RECRUITER), createJob);
 *
 * 401 = we don't know who you are. 403 = we know who you are, but you're not allowed.
 */
const ApiError = require('../utils/ApiError');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { authorize };
