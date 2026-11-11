/**
 * /api/auth routes.
 *
 * Each route lists its middleware in the order they run. For example, a
 * register request goes: rate limit -> validate body -> register controller.
 */
const { Router } = require('express');
const { register, login, getMe } = require('../controllers/auth.controller');
const { registerRules, loginRules } = require('../validators/auth.validators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = Router();

router.post('/register', authLimiter, validate(registerRules), register);
router.post('/login', authLimiter, validate(loginRules), login);
router.get('/me', authenticate, getMe);

module.exports = router;
