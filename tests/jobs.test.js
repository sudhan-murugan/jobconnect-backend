/**
 * Jobs: CRUD, ownership rules, search, filters and pagination (/api/jobs).
 */
const request = require('supertest');
const app = require('../src/app');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');
const {
  createRecruiter,
  createJobSeeker,
  createJob,
  jobInput,
  pdfFile,
  asPdf,
  countStoredFiles,
} = require('./helpers');

describe('POST /api/jobs', () => {
  it('lets a recruiter post a job', async () => {
    const { user, auth } = await createRecruiter({ name: 'Rachel Lim' });

    const res = await request(app).post('/api/jobs').set(auth).send(jobInput());

    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({ title: 'Frontend Developer', jobType: 'full-time' });
    expect(res.body.job.postedBy).toEqual({ _id: user._id.toString(), name: 'Rachel Lim' });
  });

  it('takes the owner from the token, never from the request body', async () => {
    const { user, auth } = await createRecruiter();
    const { user: someoneElse } = await createRecruiter();

    const res = await request(app)
      .post('/api/jobs')
      .set(auth)
      .send(jobInput({ postedBy: someoneElse._id.toString() }));

    expect(res.body.job.postedBy._id).toBe(user._id.toString());
  });

  it('cleans up input: trims text, removes duplicate skills, defaults the currency', async () => {
    const { auth } = await createRecruiter();

    const res = await request(app)
      .post('/api/jobs')
      .set(auth)
      .send(jobInput({ title: '  Backend Engineer  ', skills: ['Node.js', ' node.js ', 'MongoDB'], salaryRange: { min: '4000', max: 6000 } }));

    expect(res.status).toBe(201);
    expect(res.body.job.title).toBe('Backend Engineer');
    expect(res.body.job.skills).toEqual(['Node.js', 'MongoDB']);
    expect(res.body.job.salaryRange).toEqual({ min: 4000, max: 6000, currency: 'SGD' });
  });

  it('accepts a job without a salary', async () => {
    const { auth } = await createRecruiter();
    const { salaryRange, ...withoutSalary } = jobInput(); // eslint-disable-line no-unused-vars

    const res = await request(app).post('/api/jobs').set(auth).send(withoutSalary);

    expect(res.status).toBe(201);
    expect(res.body.job).not.toHaveProperty('salaryRange');
  });

  it('returns 401 without a token and 403 for job seekers', async () => {
    const { auth: seekerAuth } = await createJobSeeker();

    const anonymous = await request(app).post('/api/jobs').send(jobInput());
    const asSeeker = await request(app).post('/api/jobs').set(seekerAuth).send(jobInput());

    expect(anonymous.status).toBe(401);
    expect(asSeeker.status).toBe(403);
    expect(await Job.countDocuments()).toBe(0);
  });

  it('validates the body and reports each invalid field', async () => {
    const { auth } = await createRecruiter();

    const res = await request(app)
      .post('/api/jobs')
      .set(auth)
      .send({ title: '', description: 'too short', jobType: 'intern', salaryRange: { min: 9000, max: 1000, currency: 'dollars' } });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['title', 'description', 'company', 'location', 'jobType', 'salaryRange.max', 'salaryRange.currency'])
    );
  });

  it('requires both a minimum and a maximum when a salary is given', async () => {
    const { auth } = await createRecruiter();

    const res = await request(app).post('/api/jobs').set(auth).send(jobInput({ salaryRange: { min: 5000 } }));

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'salaryRange', message: 'Salary range needs both a minimum and a maximum' }]);
  });
});

describe('GET /api/jobs', () => {
  let recruiter;
  let otherRecruiter;

  // Jobs created one by one, so "newest first" order is predictable.
  beforeEach(async () => {
    ({ user: recruiter } = await createRecruiter());
    ({ user: otherRecruiter } = await createRecruiter());
    const jobs = [
      { title: 'Backend Engineer (Node.js)', skills: ['Node.js'], location: 'Singapore (Changi)', jobType: 'full-time' },
      { title: 'Data Analyst', description: 'Turn data into insights with SQL and dashboards for the sales team.', skills: ['SQL'], location: 'Singapore (CBD)', jobType: 'part-time' },
      { title: 'React Native Developer', skills: ['React Native'], location: 'Remote (APAC)', jobType: 'remote' },
      { title: 'Frontend Developer', skills: ['React'], location: 'Singapore (Marina Bay)', jobType: 'full-time' },
    ];
    for (const [index, job] of jobs.entries()) {
      await createJob(index === 2 ? otherRecruiter : recruiter, { ...job, createdAt: new Date(Date.now() - (10 - index) * 60_000) });
    }
  });

  const titles = (res) => res.body.jobs.map((job) => job.title);

  it('lists jobs newest first with pagination info', async () => {
    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Frontend Developer', 'React Native Developer', 'Data Analyst', 'Backend Engineer (Node.js)']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 4, totalPages: 1 });
  });

  it('pages through results', async () => {
    const res = await request(app).get('/api/jobs?page=2&limit=3');

    expect(titles(res)).toEqual(['Backend Engineer (Node.js)']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
  });

  it('only shows the name of the recruiter, not their email', async () => {
    const res = await request(app).get('/api/jobs');

    expect(Object.keys(res.body.jobs[0].postedBy).sort()).toEqual(['_id', 'name']);
  });

  it('searches by keyword, best matches first', async () => {
    const res = await request(app).get('/api/jobs?keyword=react');

    expect(titles(res)).toEqual(expect.arrayContaining(['Frontend Developer', 'React Native Developer']));
    expect(titles(res)).toHaveLength(2);
    expect(titles(res)[0]).toBe('React Native Developer'); // "React" in the title outranks skills only
  });

  it('matches keyword word forms (stemming)', async () => {
    const res = await request(app).get('/api/jobs?keyword=dashboard');

    expect(titles(res)).toEqual(['Data Analyst']);
  });

  it('filters by location (case-insensitive, partial match)', async () => {
    const res = await request(app).get('/api/jobs?location=SINGAPORE');

    expect(titles(res)).toHaveLength(3);
    expect(titles(res)).not.toContain('React Native Developer');
  });

  it('treats regex characters in the location literally', async () => {
    const res = await request(app).get('/api/jobs?location=.*');

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(0);
  });

  it('filters by job type and by recruiter, and combines filters', async () => {
    const remote = await request(app).get('/api/jobs?jobType=remote');
    const byOther = await request(app).get(`/api/jobs?postedBy=${otherRecruiter._id}`);
    const combined = await request(app).get('/api/jobs?location=singapore&jobType=full-time&keyword=developer');

    expect(titles(remote)).toEqual(['React Native Developer']);
    expect(titles(byOther)).toEqual(['React Native Developer']);
    expect(titles(combined)).toEqual(['Frontend Developer']);
  });

  it('ignores empty filters', async () => {
    const res = await request(app).get('/api/jobs?keyword=&location=&jobType=&page=');

    expect(res.body.pagination.total).toBe(4);
  });

  it('rejects invalid query parameters', async () => {
    const res = await request(app).get('/api/jobs?page=0&limit=500&jobType=intern&postedBy=abc&keyword=a&keyword=b');

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['jobType', 'keyword', 'limit', 'page', 'postedBy']);
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns one job', async () => {
    const { user } = await createRecruiter();
    const job = await createJob(user);

    const res = await request(app).get(`/api/jobs/${job._id}`);

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe('Frontend Developer');
  });

  it('returns 404 for a job that does not exist and 400 for an invalid id', async () => {
    const missing = await request(app).get('/api/jobs/000000000000000000000000');
    const invalid = await request(app).get('/api/jobs/not-an-id');

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});

describe('PUT /api/jobs/:id', () => {
  let owner;
  let job;

  beforeEach(async () => {
    owner = await createRecruiter();
    job = await createJob(owner.user);
  });

  it('lets the owner replace the job; optional fields left out are cleared', async () => {
    const { skills, salaryRange, ...required } = jobInput({ title: 'Senior Frontend Developer' }); // eslint-disable-line no-unused-vars

    const res = await request(app).put(`/api/jobs/${job._id}`).set(owner.auth).send(required);

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe('Senior Frontend Developer');
    const stored = await Job.findById(job._id).lean();
    expect(stored.salaryRange).toBeUndefined();
    expect(stored.skills).toEqual([]);
  });

  it("returns 403 for another recruiter and doesn't change the job", async () => {
    const other = await createRecruiter();

    const res = await request(app).put(`/api/jobs/${job._id}`).set(other.auth).send(jobInput({ title: 'Hijacked' }));

    expect(res.status).toBe(403);
    expect((await Job.findById(job._id)).title).toBe('Frontend Developer');
  });

  it('returns 403 for job seekers, 404 for a missing job and 400 for an invalid body', async () => {
    const seeker = await createJobSeeker();

    const asSeeker = await request(app).put(`/api/jobs/${job._id}`).set(seeker.auth).send(jobInput());
    const missing = await request(app).put('/api/jobs/000000000000000000000000').set(owner.auth).send(jobInput());
    const invalid = await request(app).put(`/api/jobs/${job._id}`).set(owner.auth).send({ title: 'Only a title' });

    expect(asSeeker.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});

describe('DELETE /api/jobs/:id', () => {
  it('lets the owner delete the job', async () => {
    const owner = await createRecruiter();
    const job = await createJob(owner.user);

    const res = await request(app).delete(`/api/jobs/${job._id}`).set(owner.auth);

    expect(res.status).toBe(204);
    expect(await Job.findById(job._id)).toBeNull();
  });

  it('also deletes the applications and their resume files', async () => {
    const owner = await createRecruiter();
    const seeker = await createJobSeeker();
    const job = await createJob(owner.user);
    await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).attach('resume', pdfFile, asPdf());
    expect(await Application.countDocuments()).toBe(1);
    expect(await countStoredFiles()).toBe(1);

    await request(app).delete(`/api/jobs/${job._id}`).set(owner.auth);

    expect(await Application.countDocuments()).toBe(0);
    expect(await countStoredFiles()).toBe(0);
  });

  it("returns 403 for another recruiter and keeps the job", async () => {
    const owner = await createRecruiter();
    const other = await createRecruiter();
    const job = await createJob(owner.user);

    const res = await request(app).delete(`/api/jobs/${job._id}`).set(other.auth);

    expect(res.status).toBe(403);
    expect(await Job.findById(job._id)).not.toBeNull();
  });
});

describe('GET /api/jobs/mine', () => {
  it("lists only the recruiter's own jobs, with applicant counts", async () => {
    const owner = await createRecruiter();
    const other = await createRecruiter();
    const seeker = await createJobSeeker();
    const job = await createJob(owner.user, { title: 'Mine' });
    await createJob(other.user, { title: 'Not mine' });
    await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).attach('resume', pdfFile, asPdf());

    const res = await request(app).get('/api/jobs/mine').set(owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.jobs.map((j) => j.title)).toEqual(['Mine']);
    expect(res.body.jobs[0].applicationCounts).toEqual({ total: 1, applied: 1, shortlisted: 0, rejected: 0 });
  });

  it('is only for recruiters', async () => {
    const seeker = await createJobSeeker();

    const res = await request(app).get('/api/jobs/mine').set(seeker.auth);

    expect(res.status).toBe(403);
  });
});
