/**
 * Shared test helpers: create users and jobs directly in the database (fast),
 * and build requests and files for the API.
 */
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Job = require('../src/models/Job');
const { signToken } = require('../src/utils/token');
const { ROLES } = require('../src/utils/constants');
const { createSimplePdf } = require('../scripts/samplePdf');

let userCount = 0;

// Creates a user and returns { user, token, auth } where `auth` is the
// header object for supertest: request(app).get(...).set(auth)
async function createUser({ role = ROLES.JOB_SEEKER, password = 'secret123', ...fields } = {}) {
  userCount += 1;
  const user = new User({
    name: `Test User ${userCount}`,
    email: `user${userCount}@example.com`,
    role,
    ...fields,
  });
  await user.setPassword(password);
  await user.save();
  const token = signToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

const createJobSeeker = (fields) => createUser({ role: ROLES.JOB_SEEKER, ...fields });
const createRecruiter = (fields) => createUser({ role: ROLES.RECRUITER, ...fields });

// A valid request body for POST/PUT /api/jobs.
function jobInput(overrides = {}) {
  return {
    title: 'Frontend Developer',
    // Deliberately free of skill words, so keyword-search tests stay predictable.
    description: 'Join a friendly product team and help build modern web applications.',
    company: 'Test Co',
    location: 'Singapore',
    jobType: 'full-time',
    skills: ['React', 'CSS'],
    salaryRange: { min: 5000, max: 7000, currency: 'SGD' },
    ...overrides,
  };
}

function createJob(recruiter, overrides = {}) {
  return Job.create({ ...jobInput(overrides), postedBy: recruiter._id });
}

// A small, valid PDF file.
const pdfFile = createSimplePdf(['Test Resume', 'Skills: React, Node.js']);

// Options for supertest's .attach() so the upload looks like a browser's.
const asPdf = (filename = 'resume.pdf') => ({ filename, contentType: 'application/pdf' });

// supertest doesn't collect binary responses (like PDFs) by default; this does.
function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

// Number of files currently stored in GridFS (to check nothing is left behind).
function countStoredFiles() {
  return mongoose.connection.db.collection('resumes.files').countDocuments();
}

module.exports = {
  createUser,
  createJobSeeker,
  createRecruiter,
  jobInput,
  createJob,
  pdfFile,
  asPdf,
  binaryParser,
  countStoredFiles,
};
