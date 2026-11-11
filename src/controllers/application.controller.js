/**
 * Application controllers: applying to jobs and reviewing applicants.
 */
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const Application = require('../models/Application');
const ApiError = require('../utils/ApiError');
const { APPLICATION_STATUSES } = require('../utils/constants');
const { findJobOrThrow, findOwnedJobOrThrow } = require('./job.controller');
const fileStorage = require('../services/fileStorage');

// What a recruiter sees about an applicant. Never the password hash or anything private.
const APPLICANT_FIELDS = 'name email headline skills location';
const JOB_SUMMARY_FIELDS = 'title company location jobType salaryRange';

const alreadyAppliedError = () => new ApiError(409, 'You have already applied to this job');

// Keep only a safe, readable file name (no folders, control characters or quotes).
function cleanFilename(originalName) {
  const name = path.basename(originalName).replace(/[\u0000-\u001f\u007f"\\]/g, '').trim();
  return (name || 'resume.pdf').slice(-100);
}

// Counts per status, e.g. { total: 3, applied: 1, shortlisted: 1, rejected: 1 }
function countByStatus(applications) {
  const counts = { total: applications.length };
  for (const status of Object.values(APPLICATION_STATUSES)) counts[status] = 0;
  for (const application of applications) counts[application.status] += 1;
  return counts;
}

// Loads an application with its job's owner; 404 if it doesn't exist.
async function findApplicationOrThrow(id) {
  const application = await Application.findById(id).populate('job', 'title postedBy');
  if (!application) throw new ApiError(404, 'Application not found');
  return application;
}

// POST /api/jobs/:id/apply (job seekers)
async function applyToJob(req, res) {
  if (!req.file) {
    throw new ApiError(400, 'Validation failed', [
      { field: 'resume', message: 'Attach your resume as a PDF' },
    ]);
  }

  const job = await findJobOrThrow(req.params.id);
  if (await Application.exists({ job: job._id, applicant: req.user._id })) {
    throw alreadyAppliedError();
  }

  // Only now, after every check has passed, store the file.
  const filename = cleanFilename(req.file.originalname);
  const fileId = await fileStorage.saveFile({
    buffer: req.file.buffer,
    filename,
    contentType: 'application/pdf',
    metadata: { owner: req.user._id, job: job._id },
  });

  try {
    const application = await Application.create({
      job: job._id,
      applicant: req.user._id,
      resume: { fileId, filename, size: req.file.size },
      coverNote: req.body.coverNote ?? '',
    });
    await application.populate('job', JOB_SUMMARY_FIELDS);
    res.status(201).json({ application });
  } catch (err) {
    // Don't leave an orphaned file behind if the application wasn't saved.
    await fileStorage.deleteFile(fileId);
    // Two identical requests at the same moment: the unique index rejects the second.
    if (err.code === 11000) throw alreadyAppliedError();
    throw err;
  }
}

// GET /api/applications/me (job seekers): their own applications, newest first.
// Optional ?job=<id> checks whether they've applied to one particular job.
async function listMyApplications(req, res) {
  const filter = { applicant: req.user._id };
  if (req.validatedQuery.job) filter.job = req.validatedQuery.job;

  const applications = await Application.find(filter)
    .sort({ createdAt: -1 })
    .populate('job', JOB_SUMMARY_FIELDS);

  res.status(200).json({ applications, counts: countByStatus(applications) });
}

// GET /api/jobs/:id/applications (recruiters; only for their own job)
async function listJobApplications(req, res) {
  const job = await findOwnedJobOrThrow(req.params.id, req.user);

  const applications = await Application.find({ job: job._id })
    .sort({ createdAt: -1 })
    .populate('applicant', APPLICANT_FIELDS);

  res.status(200).json({
    job: { _id: job._id, title: job.title, company: job.company, location: job.location },
    applications,
    counts: countByStatus(applications),
  });
}

// PATCH /api/applications/:id/status (recruiters; only for their own job)
async function updateApplicationStatus(req, res) {
  const application = await findApplicationOrThrow(req.params.id);
  if (!application.job?.isOwnedBy(req.user)) {
    throw new ApiError(403, 'You can only update applications for jobs you posted');
  }

  application.status = req.body.status;
  await application.save();
  res.status(200).json({ application });
}

// GET /api/applications/:id/resume: only the applicant and the job's recruiter.
async function downloadResume(req, res) {
  const application = await findApplicationOrThrow(req.params.id);
  const isApplicant = application.applicant.equals(req.user._id);
  const isJobOwner = Boolean(application.job?.isOwnedBy(req.user));
  if (!isApplicant && !isJobOwner) {
    throw new ApiError(403, 'You do not have access to this resume');
  }

  const file = await fileStorage.getFileInfo(application.resume.fileId);
  if (!file) throw new ApiError(404, 'Resume file not found');

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': file.length,
    // Personal documents: browsers and proxies must not keep copies.
    'Cache-Control': 'private, no-store',
  });
  // Sets Content-Disposition with the file name, safely encoded.
  res.attachment(application.resume.filename);
  await pipeline(fileStorage.openDownloadStream(file._id), res);
}

module.exports = {
  applyToJob,
  listMyApplications,
  listJobApplications,
  updateApplicationStatus,
  downloadResume,
};
