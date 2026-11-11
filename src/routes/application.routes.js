/**
 * /api/applications routes.
 *
 * (Applying and listing a job's applicants live under /api/jobs/:id/..., see job.routes.js.)
 */
const { Router } = require('express');
const {
  listMyApplications,
  updateApplicationStatus,
  downloadResume,
} = require('../controllers/application.controller');
const {
  myApplicationsRules,
  updateStatusRules,
  applicationIdRules,
} = require('../validators/application.validators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../utils/constants');

const router = Router();

router.get('/me', authenticate, authorize(ROLES.JOB_SEEKER), validate(myApplicationsRules), listMyApplications);
router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.RECRUITER),
  validate(updateStatusRules),
  updateApplicationStatus
);
// Both roles can download: the controller checks it's the applicant or the job's recruiter.
router.get('/:id/resume', authenticate, validate(applicationIdRules), downloadResume);

module.exports = router;
