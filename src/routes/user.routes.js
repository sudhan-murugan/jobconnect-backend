/**
 * /api/users routes: the logged-in user's own profile.
 */
const { Router } = require('express');
const {
  updateProfile,
  uploadProfileResume,
  downloadProfileResume,
  deleteProfileResume,
} = require('../controllers/user.controller');
const { updateProfileRules } = require('../validators/user.validators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { uploadResume } = require('../middleware/upload');
const { ROLES } = require('../utils/constants');

const router = Router();
const jobSeekerOnly = [authenticate, authorize(ROLES.JOB_SEEKER)];

// Every route here requires login; resume routes are for job seekers only.
router.put('/me', authenticate, validate(updateProfileRules), updateProfile);
router.post('/me/resume', ...jobSeekerOnly, uploadResume, uploadProfileResume);
router.get('/me/resume', ...jobSeekerOnly, downloadProfileResume);
router.delete('/me/resume', ...jobSeekerOnly, deleteProfileResume);

module.exports = router;
