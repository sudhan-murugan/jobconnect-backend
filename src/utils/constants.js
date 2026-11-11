/**
 * Shared constants. Using these instead of typing 'recruiter' by hand avoids
 * silent bugs from typos.
 */
const ROLES = Object.freeze({
  JOB_SEEKER: 'job_seeker',
  RECRUITER: 'recruiter',
});

const JOB_TYPES = Object.freeze({
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  REMOTE: 'remote',
});

const APPLICATION_STATUSES = Object.freeze({
  APPLIED: 'applied',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
});

// Pagination for GET /api/jobs
const PAGINATION = Object.freeze({
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
});

const MAX_RESUME_SIZE_MB = 5;

module.exports = { ROLES, JOB_TYPES, APPLICATION_STATUSES, PAGINATION, MAX_RESUME_SIZE_MB };
