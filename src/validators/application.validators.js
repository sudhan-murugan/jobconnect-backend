/**
 * Validation rules for application requests.
 */
const { body, param, query } = require('express-validator');
const { APPLICATION_STATUSES } = require('../utils/constants');

const STATUS_VALUES = Object.values(APPLICATION_STATUSES);

// POST /api/jobs/:id/apply (multipart form: "resume" file + "coverNote" text)
const applyRules = [
  param('id').isMongoId().withMessage('Invalid job id'),
  body('coverNote')
    .optional()
    .isString()
    .withMessage('Cover note must be text')
    .bail()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Cover note must be at most 2000 characters'),
];

// GET /api/applications/me?job=<jobId>
const myApplicationsRules = [
  query('job').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid job id'),
];

// GET /api/jobs/:id/applications
const jobApplicationsRules = [param('id').isMongoId().withMessage('Invalid job id')];

// PATCH /api/applications/:id/status
const updateStatusRules = [
  param('id').isMongoId().withMessage('Invalid application id'),
  body('status')
    .isIn(STATUS_VALUES)
    .withMessage(`Status must be one of: ${STATUS_VALUES.join(', ')}`),
];

// GET /api/applications/:id/resume
const applicationIdRules = [param('id').isMongoId().withMessage('Invalid application id')];

module.exports = {
  applyRules,
  myApplicationsRules,
  jobApplicationsRules,
  updateStatusRules,
  applicationIdRules,
};
