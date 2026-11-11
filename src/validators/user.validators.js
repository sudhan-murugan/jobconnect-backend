/**
 * Validation rules for /api/users requests.
 */
const { body } = require('express-validator');
const { skillsRules } = require('./common');

// PUT /api/users/me: replaces the editable profile fields.
// (Email, password and role can't be changed here.)
const updateProfileRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),
  body('headline')
    .optional()
    .isString()
    .withMessage('Headline must be text')
    .bail()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Headline must be at most 150 characters'),
  body('location')
    .optional()
    .isString()
    .withMessage('Location must be text')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be at most 100 characters'),
  ...skillsRules,
];

module.exports = { updateProfileRules };
