/**
 * Seeds demo data: a recruiter, three job seekers (two with a profile resume),
 * sample jobs, and applications (with generated PDF resumes) in different statuses.
 *
 *   npm run seed
 *
 * Safe to run repeatedly. It only touches the demo accounts below, the jobs
 * posted by the demo recruiter, and applications to/from them; other users and
 * jobs are left alone. All people and companies are fictional.
 */
const mongoose = require('mongoose');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');
const fileStorage = require('../src/services/fileStorage');
const { createSimplePdf } = require('./samplePdf');
const { ROLES, JOB_TYPES, APPLICATION_STATUSES } = require('../src/utils/constants');

const DEMO_PASSWORD = 'Demo1234';

const DEMO_USERS = [
  { name: 'Rachel Lim', email: 'demo.recruiter@example.com', role: ROLES.RECRUITER },
  {
    name: 'Daniel Ong',
    email: 'demo.seeker@example.com',
    role: ROLES.JOB_SEEKER,
    headline: 'Full-stack developer (React, Node.js)',
    skills: ['React', 'Node.js', 'MongoDB'],
    location: 'Singapore',
    withProfileResume: true,
  },
  {
    name: 'Priya Nair',
    email: 'demo.seeker2@example.com',
    role: ROLES.JOB_SEEKER,
    headline: 'Frontend engineer focused on accessible UIs',
    skills: ['React', 'TypeScript', 'CSS', 'Accessibility'],
    location: 'Singapore (Tampines)',
    withProfileResume: true,
  },
  {
    name: 'Tan Wei Jie',
    email: 'demo.seeker3@example.com',
    role: ROLES.JOB_SEEKER,
    headline: 'QA engineer moving into full-stack development',
    skills: ['JavaScript', 'Playwright', 'Node.js'],
    location: 'Singapore (Jurong East)',
  },
];

const { APPLIED, SHORTLISTED, REJECTED } = APPLICATION_STATUSES;

// Who applies to which job (matched by title), with what status.
const APPLICATIONS = [
  {
    email: 'demo.seeker@example.com',
    jobTitle: 'Senior Full-Stack Engineer (MERN)',
    status: SHORTLISTED,
    coverNote:
      'I have built two MERN apps end to end, including JWT auth and file uploads, and would love to work on payments at scale.',
  },
  {
    email: 'demo.seeker@example.com',
    jobTitle: 'Frontend Developer (React)',
    status: APPLIED,
    coverNote: 'React is my favourite part of the stack, and I care a lot about accessibility and performance.',
  },
  { email: 'demo.seeker@example.com', jobTitle: 'Backend Engineer (Node.js)', status: REJECTED, coverNote: '' },
  {
    email: 'demo.seeker2@example.com',
    jobTitle: 'Senior Full-Stack Engineer (MERN)',
    status: APPLIED,
    coverNote: 'Five years of React and two of Node.js. Happy to share examples of my work.',
  },
  {
    email: 'demo.seeker2@example.com',
    jobTitle: 'Frontend Developer (React)',
    status: SHORTLISTED,
    coverNote: 'I led the move to a design system at my last company and would bring that experience here.',
  },
  {
    email: 'demo.seeker3@example.com',
    jobTitle: 'Senior Full-Stack Engineer (MERN)',
    status: REJECTED,
    coverNote: 'Keen to grow into a full-stack role; I have strong testing experience.',
  },
  {
    email: 'demo.seeker3@example.com',
    jobTitle: 'QA Automation Engineer',
    status: APPLIED,
    coverNote: 'I set up Playwright end-to-end tests and CI for my current team.',
  },
];

const { FULL_TIME, PART_TIME, REMOTE } = JOB_TYPES;

// daysAgo spreads createdAt over the past weeks so "newest first" looks realistic.
const JOBS = [
  {
    title: 'Senior Full-Stack Engineer (MERN)',
    company: 'Lion City Fintech',
    location: 'Singapore (CBD, Hybrid)',
    jobType: FULL_TIME,
    salaryRange: { min: 7000, max: 10000, currency: 'SGD' },
    skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'AWS'],
    description:
      'Build and scale the payments dashboard used by thousands of SMEs across Southeast Asia. You will own features end to end, from MongoDB schema design to React UI, and mentor two junior engineers.',
    daysAgo: 1,
  },
  {
    title: 'Frontend Developer (React)',
    company: 'Marina Bay Digital',
    location: 'Singapore (Marina Bay)',
    jobType: FULL_TIME,
    salaryRange: { min: 5000, max: 7000, currency: 'SGD' },
    skills: ['React', 'JavaScript', 'Tailwind CSS', 'Testing Library'],
    description:
      'Join our product team to build fast, accessible web apps for retail clients. You will turn Figma designs into reusable React components and work closely with designers and backend engineers.',
    daysAgo: 2,
  },
  {
    title: 'Backend Engineer (Node.js)',
    company: 'Orchid Logistics',
    location: 'Singapore (Changi Business Park)',
    jobType: FULL_TIME,
    salaryRange: { min: 6000, max: 8500, currency: 'SGD' },
    skills: ['Node.js', 'Express', 'MongoDB', 'Docker', 'REST APIs'],
    description:
      'Design REST APIs and background jobs that track thousands of shipments a day. Experience with Express, MongoDB indexing and Docker-based deployments is a strong plus.',
    daysAgo: 3,
  },
  {
    title: 'Junior Software Developer',
    company: 'Kopi Tech Studio',
    location: 'Singapore (One-North)',
    jobType: FULL_TIME,
    salaryRange: { min: 3800, max: 4800, currency: 'SGD' },
    skills: ['JavaScript', 'HTML', 'CSS', 'Git'],
    description:
      'A great first role for a fresh graduate or bootcamp alumnus. You will pair with senior developers on client web projects and learn modern JavaScript, code reviews and agile delivery.',
    daysAgo: 4,
  },
  {
    title: 'Remote React Native Developer',
    company: 'Sunda Apps',
    location: 'Remote (APAC time zones)',
    jobType: REMOTE,
    salaryRange: { min: 6000, max: 9000, currency: 'SGD' },
    skills: ['React Native', 'TypeScript', 'Redux', 'REST APIs'],
    description:
      'Build our consumer mobile app used in five countries. Fully remote within APAC time zones, with a quarterly team meet-up in Singapore.',
    daysAgo: 5,
  },
  {
    title: 'DevOps Engineer',
    company: 'Lion City Fintech',
    location: 'Singapore (CBD, Hybrid)',
    jobType: FULL_TIME,
    salaryRange: { min: 7500, max: 10500, currency: 'SGD' },
    skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
    description:
      'Own our cloud infrastructure and CI/CD pipelines. You will automate deployments with Terraform, run Kubernetes workloads and improve monitoring and incident response.',
    daysAgo: 6,
  },
  {
    title: 'Part-Time Web Developer',
    company: 'Hawker Hub',
    location: 'Singapore (Tampines)',
    jobType: PART_TIME,
    salaryRange: { min: 2000, max: 2800, currency: 'SGD' },
    skills: ['JavaScript', 'React', 'CSS'],
    description:
      'Help a growing F&B ordering platform maintain its customer website, about 20 hours a week. Flexible hours, suitable for students or career switchers.',
    daysAgo: 8,
  },
  {
    title: 'Data Analyst',
    company: 'Merlion Analytics',
    location: 'Singapore (Raffles Place)',
    jobType: FULL_TIME,
    salaryRange: { min: 5000, max: 6500, currency: 'SGD' },
    skills: ['SQL', 'Python', 'Power BI', 'Excel'],
    description:
      'Turn business questions into dashboards and insights for regional sales teams. You will write SQL, clean data with Python and present findings to stakeholders.',
    daysAgo: 9,
  },
  {
    title: 'QA Automation Engineer',
    company: 'Orchid Logistics',
    location: 'Singapore (Changi Business Park)',
    jobType: FULL_TIME,
    salaryRange: { min: 5000, max: 7000, currency: 'SGD' },
    skills: ['Playwright', 'Jest', 'JavaScript', 'CI/CD'],
    description:
      'Build automated test suites for our web and API platforms. You will set up end-to-end tests with Playwright and make testing part of every pull request.',
    daysAgo: 11,
  },
  {
    title: 'Remote Technical Writer (Developer Docs)',
    company: 'Sunda Apps',
    location: 'Remote (Worldwide)',
    jobType: REMOTE,
    skills: ['Technical Writing', 'Markdown', 'APIs'],
    description:
      'Write clear guides and API references for our developer platform. You should be comfortable reading code samples and explaining technical concepts simply.',
    daysAgo: 13,
  },
  {
    title: 'UI/UX Designer',
    company: 'Marina Bay Digital',
    location: 'Singapore (Marina Bay)',
    jobType: FULL_TIME,
    salaryRange: { min: 4500, max: 6500, currency: 'SGD' },
    skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
    description:
      'Shape the experience of web and mobile products for retail and banking clients. You will run user interviews, build prototypes in Figma and maintain our design system.',
    daysAgo: 15,
  },
  {
    title: 'Part-Time IT Support Assistant',
    company: 'Kopi Tech Studio',
    location: 'Singapore (Jurong East)',
    jobType: PART_TIME,
    skills: ['Troubleshooting', 'Windows', 'Networking'],
    description:
      'Support our office of 40 staff with laptops, accounts and network issues three days a week. A good fit for a polytechnic student in IT or a related field.',
    daysAgo: 18,
  },
];

// A small PDF resume for a demo job seeker.
function demoResumePdf(user) {
  return createSimplePdf([
    user.name,
    user.headline,
    `Location: ${user.location}`,
    `Skills: ${user.skills.join(', ')}`,
    `Email: ${user.email}`,
    '(Demo resume generated by the JobConnect seed script)',
  ]);
}

async function upsertDemoUser({ name, email, role, withProfileResume = false, ...profile }) {
  const user = (await User.findOne({ email })) || new User({ email });
  user.set({ name, role, headline: '', skills: [], location: '', ...profile });
  await user.setPassword(DEMO_PASSWORD);

  // Replace any profile resume from a previous run.
  if (user.resume) await fileStorage.deleteFile(user.resume.fileId);
  user.resume = undefined;
  if (withProfileResume) {
    const pdf = demoResumePdf(user);
    const filename = `${name} - Resume.pdf`;
    const fileId = await fileStorage.saveFile({
      buffer: pdf,
      filename,
      contentType: 'application/pdf',
      metadata: { owner: user._id, kind: 'profile-resume' },
    });
    user.resume = { fileId, filename, size: pdf.length, uploadedAt: new Date() };
  }

  await user.save();
  return user;
}

// Removes the demo data from a previous run: applications to the demo
// recruiter's jobs or by demo seekers (and their resume files), then the jobs.
async function removePreviousDemoData(recruiter, seekers) {
  const jobIds = await Job.find({ postedBy: recruiter._id }).distinct('_id');
  const filter = { $or: [{ job: { $in: jobIds } }, { applicant: { $in: seekers.map((s) => s._id) } }] };
  const applications = await Application.find(filter).select('resume.fileId');
  await Promise.all(applications.map((a) => fileStorage.deleteFile(a.resume.fileId)));
  await Application.deleteMany(filter);
  await Job.deleteMany({ postedBy: recruiter._id });
}

async function createDemoApplication({ email, jobTitle, status, coverNote }, usersByEmail, jobsByTitle) {
  const applicant = usersByEmail.get(email);
  const job = jobsByTitle.get(jobTitle);
  const filename = `${applicant.name} - Resume.pdf`;
  const pdf = demoResumePdf(applicant);
  const fileId = await fileStorage.saveFile({
    buffer: pdf,
    filename,
    contentType: 'application/pdf',
    metadata: { owner: applicant._id, job: job._id },
  });
  await Application.create({
    job: job._id,
    applicant: applicant._id,
    resume: { fileId, filename, size: pdf.length },
    coverNote,
    status,
  });
}

async function seed() {
  await connectDB(config.mongoUri);

  const users = await Promise.all(DEMO_USERS.map(upsertDemoUser));
  const recruiter = users.find((user) => user.role === ROLES.RECRUITER);
  const seekers = users.filter((user) => user.role === ROLES.JOB_SEEKER);

  await removePreviousDemoData(recruiter, seekers);

  // Fresh copy of the sample jobs.
  const now = Date.now();
  const jobs = await Job.insertMany(
    JOBS.map(({ daysAgo, ...job }) => ({
      ...job,
      postedBy: recruiter._id,
      createdAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
    }))
  );

  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const jobsByTitle = new Map(jobs.map((job) => [job.title, job]));
  for (const application of APPLICATIONS) {
    await createDemoApplication(application, usersByEmail, jobsByTitle);
  }

  console.log(`Seeded database "${mongoose.connection.name}":`);
  console.log(`  ${jobs.length} jobs posted by ${recruiter.email}`);
  console.log(`  ${APPLICATIONS.length} applications from ${seekers.length} job seekers`);
  for (const user of DEMO_USERS) {
    console.log(`  Demo ${user.role}: ${user.email} / ${DEMO_PASSWORD}`);
  }
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
