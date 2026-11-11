/**
 * Auth controllers: the functions that handle /api/auth requests.
 *
 * By the time these run, the `validate` middleware has already checked and
 * cleaned req.body, so they only deal with business logic.
 */
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password, role } = req.body;

  // Friendly early check. The unique index on email is the real guarantee
  // (see error.js for how a duplicate-key error becomes a 409).
  if (await User.exists({ email })) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const user = new User({ name, email, role });
  await user.setPassword(password);
  await user.save();

  // 201 Created. Return a token so the user is logged in straight away.
  res.status(201).json({ token: signToken(user), user });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  // passwordHash is excluded by default (select: false), so ask for it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');

  // Same message whether the email or the password is wrong, so attackers
  // can't use this endpoint to discover which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.status(200).json({ token: signToken(user), user });
}

// GET /api/auth/me (requires `authenticate`, which sets req.user)
function getMe(req, res) {
  res.status(200).json({ user: req.user });
}

module.exports = { register, login, getMe };
