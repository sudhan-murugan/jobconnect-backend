/**
 * Job controllers: handlers for /api/jobs.
 */
const Job = require('../models/Job');
const Application = require('../models/Application');
const ApiError = require('../utils/ApiError');
const escapeRegex = require('../utils/escapeRegex');
const { PAGINATION, APPLICATION_STATUSES } = require('../utils/constants');
const fileStorage = require('../services/fileStorage');

// Only expose the poster's name, never their email or other private data.
const POSTED_BY_FIELDS = 'name';

// Loads a job or throws 404. Also used by the application controllers.
async function findJobOrThrow(id) {
  const job = await Job.findById(id);
  if (!job) throw new ApiError(404, 'Job not found');
  return job;
}

// Loads a job and checks that `user` posted it: 404 if missing, 403 if not the owner.
async function findOwnedJobOrThrow(id, user) {
  const job = await findJobOrThrow(id);
  if (!job.isOwnedBy(user)) {
    throw new ApiError(403, 'You can only manage jobs you posted');
  }
  return job;
}

// GET /api/jobs: public list with search, filters and pagination.
async function listJobs(req, res) {
  const {
    keyword,
    location,
    jobType,
    postedBy,
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = req.validatedQuery;

  // Build the MongoDB filter only from the params that were provided.
  const filter = {};
  if (keyword) {
    // Uses the text index: matches whole words (with stemming, so "developers"
    // matches "developer") in title, skills, company and description.
    filter.$text = { $search: keyword };
  }
  if (location) {
    // Case-insensitive "contains" match, e.g. "singapore" matches "Singapore (Hybrid)".
    filter.location = { $regex: escapeRegex(location), $options: 'i' };
  }
  if (jobType) filter.jobType = jobType;
  if (postedBy) filter.postedBy = postedBy;

  // With a keyword, show the most relevant jobs first; otherwise the newest.
  const sort = keyword ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 };

  // Run the page query and the total count at the same time.
  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('postedBy', POSTED_BY_FIELDS),
    Job.countDocuments(filter),
  ]);

  res.status(200).json({
    jobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// GET /api/jobs/mine (recruiters): their own jobs, newest first, each with
// applicant counts for the dashboard.
async function listMyJobs(req, res) {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.validatedQuery;
  const filter = { postedBy: req.user._id };

  const [jobs, total] = await Promise.all([
    // lean() returns plain objects instead of Mongoose documents: faster, and
    // we want to add an extra property to each one below.
    Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  // One aggregation query counts applications per job and status for the
  // whole page (instead of one query per job).
  const rows = await Application.aggregate([
    { $match: { job: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: { job: '$job', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const emptyCounts = () => ({
    total: 0,
    ...Object.fromEntries(Object.values(APPLICATION_STATUSES).map((status) => [status, 0])),
  });
  const countsByJob = new Map(jobs.map((job) => [job._id.toString(), emptyCounts()]));
  for (const { _id, count } of rows) {
    const counts = countsByJob.get(_id.job.toString());
    counts[_id.status] += count;
    counts.total += count;
  }

  res.status(200).json({
    jobs: jobs.map((job) => ({ ...job, applicationCounts: countsByJob.get(job._id.toString()) })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// GET /api/jobs/:id
async function getJob(req, res) {
  const job = await findJobOrThrow(req.params.id);
  await job.populate('postedBy', POSTED_BY_FIELDS);
  res.status(200).json({ job });
}

// POST /api/jobs (recruiters only)
async function createJob(req, res) {
  // req.body holds only validated fields; postedBy comes from the token,
  // never from the request body, so nobody can post as someone else.
  const job = await Job.create({ ...req.body, postedBy: req.user._id });
  await job.populate('postedBy', POSTED_BY_FIELDS);
  res.status(201).json({ job });
}

// PUT /api/jobs/:id (owner only). PUT replaces the job's editable fields.
async function updateJob(req, res) {
  const job = await findOwnedJobOrThrow(req.params.id, req.user);

  const { title, description, company, location, jobType, skills, salaryRange } = req.body;
  // Optional fields left out of a PUT are cleared, because PUT means "replace".
  job.set({ title, description, company, location, jobType, skills: skills ?? [], salaryRange });
  await job.save();

  await job.populate('postedBy', POSTED_BY_FIELDS);
  res.status(200).json({ job });
}

// DELETE /api/jobs/:id (owner only)
async function deleteJob(req, res) {
  const job = await findOwnedJobOrThrow(req.params.id, req.user);

  // Also remove the job's applications and their resume files, so nothing is
  // left pointing at a job that no longer exists.
  const applications = await Application.find({ job: job._id }).select('resume.fileId');
  await job.deleteOne();
  await Application.deleteMany({ job: job._id });
  await Promise.all(applications.map((application) => fileStorage.deleteFile(application.resume.fileId)));

  // 204 No Content: success, with nothing to send back.
  res.status(204).end();
}

module.exports = {
  listJobs,
  listMyJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  findJobOrThrow,
  findOwnedJobOrThrow,
};
