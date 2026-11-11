/**
 * /api/jobs routes.
 *
 * Reading jobs is public. Writing requires a logged-in recruiter, and
 * editing/deleting additionally requires owning the job (checked in the
 * controller, because we must load the job to know who posted it).
 */
const { Router } = require('express');
const {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
} = require('../controllers/job.controller');
const {
  createJobRules,
  updateJobRules,
  jobIdRules,
  listJobsRules,
} = require('../validators/job.validators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../utils/constants');

const router = Router();
const recruiterOnly = [authenticate, authorize(ROLES.RECRUITER)];

router.get('/', validate(listJobsRules), listJobs);
router.get('/:id', validate(jobIdRules), getJob);
router.post('/', ...recruiterOnly, validate(createJobRules), createJob);
router.put('/:id', ...recruiterOnly, validate(updateJobRules), updateJob);
router.delete('/:id', ...recruiterOnly, validate(jobIdRules), deleteJob);

module.exports = router;
