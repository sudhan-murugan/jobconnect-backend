/**
 * Validation rules for auth requests (express-validator).
 *
 * Each chain checks one field of req.body. Sanitizers like trim() and
 * toLowerCase() also CLEAN the value, so controllers receive tidy data.
 * Rules run in the order they are written.
 */
const { body } = require('express-validator');
const { ROLES } = require('../utils/constants');

const emailRule = body('email')
  .trim()
  .toLowerCase()
  .notEmpty()
  .withMessage('Email is required')
  .bail() // stop here if empty; no need to also report "invalid email"
  .isEmail()
  .withMessage('Enter a valid email address');

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),

  emailRule,

  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    // bcrypt only uses the first 72 bytes of a password, so longer ones would be silently cut.
    .isLength({ max: 72 })
    .withMessage('Password must be at most 72 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/\d/)
    .withMessage('Password must contain a number'),

  body('role')
    .isIn(Object.values(ROLES))
    .withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`),
];

const loginRules = [
  emailRule,
  // withMessage() applies to the check right before it, so each check needs its own.
  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .notEmpty()
    .withMessage('Password is required'),
];

module.exports = { registerRules, loginRules };
