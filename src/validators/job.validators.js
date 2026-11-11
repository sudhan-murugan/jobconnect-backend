/**
 * Validation rules for /api/jobs requests.
 */
const { body, param, query } = require('express-validator');
const { JOB_TYPES, PAGINATION } = require('../utils/constants');

const JOB_TYPE_VALUES = Object.values(JOB_TYPES);
const jobTypeMessage = `Job type must be one of: ${JOB_TYPE_VALUES.join(', ')}`;

// :id in the URL must look like a MongoDB ObjectId (24 hex characters).
// Without this check, "/api/jobs/abc" would reach the database and fail there.
const jobIdRule = param('id').isMongoId().withMessage('Invalid job id');

// Removes duplicate skills, ignoring case ("React" and "react" count as one).
function uniqueSkills(skills) {
  if (!Array.isArray(skills)) return skills;
  const seen = new Set();
  return skills.filter((skill) => {
    if (typeof skill !== 'string') return true; // left for the validator to reject
    const key = skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Used for both create (POST) and full update (PUT): PUT replaces the job, so
// it needs the same complete set of fields.
const jobBodyRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 120 })
    .withMessage('Title must be at most 120 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 30, max: 5000 })
    .withMessage('Description must be between 30 and 5000 characters'),

  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company is required')
    .isLength({ max: 100 })
    .withMessage('Company must be at most 100 characters'),

  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ max: 100 })
    .withMessage('Location must be at most 100 characters'),

  body('jobType').isIn(JOB_TYPE_VALUES).withMessage(jobTypeMessage),

  // Each skill: "skills.*" applies the rule to every item in the array.
  body('skills.*')
    .isString()
    .withMessage('Each skill must be text')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Skills cannot be empty')
    .isLength({ max: 40 })
    .withMessage('Each skill must be at most 40 characters'),
  body('skills')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Skills must be a list of at most 20 items')
    .customSanitizer(uniqueSkills),

  // Salary is optional, but if it's given, min and max are both required.
  // (min/max are marked optional() so that a job WITHOUT a salary doesn't get
  // an empty salaryRange object from matchedData(); the "both required" check
  // lives on the parent object instead.)
  body('salaryRange')
    .optional()
    .isObject()
    .withMessage('Salary range must be an object')
    .bail()
    .custom((range) => range.min !== undefined && range.max !== undefined)
    .withMessage('Salary range needs both a minimum and a maximum'),
  body('salaryRange.min')
    .optional()
    .isInt({ min: 0, max: 10_000_000 })
    .withMessage('Minimum salary must be a whole number of 0 or more')
    .toInt(),
  body('salaryRange.max')
    .optional()
    .isInt({ min: 0, max: 10_000_000 })
    .withMessage('Maximum salary must be a whole number of 0 or more')
    .bail()
    .toInt()
    .custom((max, { req }) => max >= Number(req.body.salaryRange.min))
    .withMessage('Maximum salary must be greater than or equal to the minimum'),
  body('salaryRange.currency')
    .optional()
    .trim()
    .toUpperCase()
    .isISO4217()
    .withMessage('Currency must be a 3-letter code such as SGD'),
];

const createJobRules = jobBodyRules;
const updateJobRules = [jobIdRule, ...jobBodyRules];
const jobIdRules = [jobIdRule];

// ?page=&limit= (shared by the job list endpoints)
const paginationRules = [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Page must be a whole number of 1 or more')
    .toInt(),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: PAGINATION.MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION.MAX_LIMIT}`)
    .toInt(),
];

// GET /api/jobs?keyword=&location=&jobType=&postedBy=&page=&limit=
// `optional({ values: 'falsy' })` treats empty values like "?keyword=" as not given.
// isString() also rejects repeated params such as "?keyword=a&keyword=b".
const listJobsRules = [
  query('keyword')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Keyword must be a single value')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Keyword must be at most 100 characters'),
  query('location')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Location must be a single value')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be at most 100 characters'),
  query('jobType').optional({ values: 'falsy' }).isIn(JOB_TYPE_VALUES).withMessage(jobTypeMessage),
  query('postedBy').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid user id'),
  ...paginationRules,
];

// GET /api/jobs/mine?page=&limit=
const myJobsRules = paginationRules;

module.exports = { createJobRules, updateJobRules, jobIdRules, listJobsRules, myJobsRules };
