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
  listMyJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
} = require('../controllers/job.controller');
const { applyToJob, listJobApplications } = require('../controllers/application.controller');
const {
  createJobRules,
  updateJobRules,
  jobIdRules,
  listJobsRules,
  myJobsRules,
} = require('../validators/job.validators');
const { applyRules, jobApplicationsRules } = require('../validators/application.validators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadResume } = require('../middleware/upload');
const { ROLES } = require('../utils/constants');

const router = Router();
const recruiterOnly = [authenticate, authorize(ROLES.RECRUITER)];
const jobSeekerOnly = [authenticate, authorize(ROLES.JOB_SEEKER)];

router.get('/', validate(listJobsRules), listJobs);
// "/mine" must come before "/:id", or Express would treat "mine" as a job id.
router.get('/mine', ...recruiterOnly, validate(myJobsRules), listMyJobs);
router.get('/:id', validate(jobIdRules), getJob);
router.post('/', ...recruiterOnly, validate(createJobRules), createJob);
router.put('/:id', ...recruiterOnly, validate(updateJobRules), updateJob);
router.delete('/:id', ...recruiterOnly, validate(jobIdRules), deleteJob);

// Applications for a job
// uploadResume runs before validate(): Multer must parse the multipart body
// first, or req.body (the cover note) would be empty.
router.post('/:id/apply', ...jobSeekerOnly, uploadResume, validate(applyRules), applyToJob);
router.get('/:id/applications', ...recruiterOnly, validate(jobApplicationsRules), listJobApplications);

module.exports = router;
