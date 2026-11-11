/**
 * Applications: applying with a resume, tracking, reviewing applicants,
 * status updates and resume downloads.
 */
const request = require('supertest');
const app = require('../src/app');
const Application = require('../src/models/Application');
const {
  createRecruiter,
  createJobSeeker,
  createJob,
  pdfFile,
  asPdf,
  binaryParser,
  countStoredFiles,
} = require('./helpers');

let recruiter;
let seeker;
let job;

beforeEach(async () => {
  recruiter = await createRecruiter();
  seeker = await createJobSeeker({ name: 'Daniel Ong', headline: 'Full-stack developer', skills: ['React'] });
  job = await createJob(recruiter.user);
});

// POST /api/jobs/:id/apply with a PDF upload
const apply = (auth, jobId = job._id) =>
  request(app).post(`/api/jobs/${jobId}/apply`).set(auth).attach('resume', pdfFile, asPdf('Daniel Resume.pdf'));

describe('POST /api/jobs/:id/apply', () => {
  it('submits an application with a PDF resume and a cover note', async () => {
    const res = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set(seeker.auth)
      .field('coverNote', '  I would love to join.  ')
      .attach('resume', pdfFile, asPdf('Daniel Resume.pdf'));

    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({
      status: 'applied',
      coverNote: 'I would love to join.',
      resume: { filename: 'Daniel Resume.pdf', size: pdfFile.length },
      resumeUrl: `/api/applications/${res.body.application._id}/resume`,
    });
    expect(res.body.application.job.title).toBe('Frontend Developer');
    // The internal storage id is never exposed.
    expect(res.body.application.resume).not.toHaveProperty('fileId');
    expect(await countStoredFiles()).toBe(1);
  });

  it('returns 401 without a token and 403 for recruiters', async () => {
    const anonymous = await request(app).post(`/api/jobs/${job._id}/apply`).attach('resume', pdfFile, asPdf());
    const asRecruiter = await apply(recruiter.auth);

    expect(anonymous.status).toBe(401);
    expect(asRecruiter.status).toBe(403);
  });

  it.each([
    ['no file', (req) => req.field('coverNote', 'hi'), 400, 'Attach your resume as a PDF'],
    ['a non-PDF file', (req) => req.attach('resume', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' }), 400, 'Resume must be a PDF file'],
    ['a text file renamed to .pdf', (req) => req.attach('resume', Buffer.from('not really a pdf'), asPdf('fake.pdf')), 400, 'This file is not a valid PDF'],
    ['a file over 5 MB', (req) => req.attach('resume', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024)]), asPdf('big.pdf')), 413, 'Resume must be 5 MB or smaller'],
  ])('rejects %s and stores nothing', async (_, addBody, status, message) => {
    const res = await addBody(request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth));

    expect(res.status).toBe(status);
    expect(res.body.details).toEqual([{ field: 'resume', message }]);
    expect(await Application.countDocuments()).toBe(0);
    expect(await countStoredFiles()).toBe(0);
  });

  it('rejects two files, a wrong field name and too many form fields', async () => {
    const twoFiles = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set(seeker.auth)
      .attach('resume', pdfFile, asPdf('a.pdf'))
      .attach('resume', pdfFile, asPdf('b.pdf'));
    const wrongField = await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).attach('cv', pdfFile, asPdf());
    let tooMany = request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth);
    for (let i = 0; i < 6; i += 1) tooMany = tooMany.field(`extra${i}`, 'x');
    tooMany = await tooMany.attach('resume', pdfFile, asPdf());

    expect(twoFiles.status).toBe(400);
    expect(wrongField.status).toBe(400);
    expect(tooMany.status).toBe(400);
    expect(await countStoredFiles()).toBe(0);
  });

  it('rejects a cover note over 2000 characters', async () => {
    const res = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set(seeker.auth)
      .field('coverNote', 'a'.repeat(2001))
      .attach('resume', pdfFile, asPdf());

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('coverNote');
  });

  it('returns 404 for a job that does not exist and 400 for an invalid id', async () => {
    const missing = await apply(seeker.auth, '000000000000000000000000');
    const invalid = await apply(seeker.auth, 'not-an-id');

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
    expect(await countStoredFiles()).toBe(0);
  });

  it('allows only one application per job (409 on the second)', async () => {
    await apply(seeker.auth);

    const second = await apply(seeker.auth);

    expect(second.status).toBe(409);
    expect(await Application.countDocuments()).toBe(1);
    expect(await countStoredFiles()).toBe(1);
  });

  it('stays at one application when the same request arrives several times at once', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => apply(seeker.auth)));

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await Application.countDocuments()).toBe(1);
    // Files saved by the requests that lost the race were cleaned up.
    expect(await countStoredFiles()).toBe(1);
  });

  describe('with the profile resume (useProfileResume=true)', () => {
    it('sends a copy of the resume saved on the profile', async () => {
      await request(app).post('/api/users/me/resume').set(seeker.auth).attach('resume', pdfFile, asPdf('Profile CV.pdf'));

      const res = await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).field('useProfileResume', 'true');

      expect(res.status).toBe(201);
      expect(res.body.application.resume.filename).toBe('Profile CV.pdf');
      expect(await countStoredFiles()).toBe(2); // profile file + the application's own copy
    });

    it('returns 400 if the stored profile file has gone missing', async () => {
      await request(app).post('/api/users/me/resume').set(seeker.auth).attach('resume', pdfFile, asPdf());
      await require('mongoose').connection.db.collection('resumes.files').deleteMany({});

      const res = await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).field('useProfileResume', 'true');

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toMatch(/could not be found/);
      expect(await Application.countDocuments()).toBe(0);
    });

    it('returns 400 when there is no profile resume', async () => {
      const res = await request(app).post(`/api/jobs/${job._id}/apply`).set(seeker.auth).field('useProfileResume', 'true');

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([{ field: 'resume', message: "You don't have a resume on your profile yet" }]);
    });
  });
});

describe('GET /api/applications/me', () => {
  it("lists the job seeker's own applications with counts per status", async () => {
    const otherJob = await createJob(recruiter.user, { title: 'Backend Engineer' });
    const someoneElse = await createJobSeeker();
    await apply(seeker.auth);
    await apply(seeker.auth, otherJob._id);
    await apply(someoneElse.auth);

    const res = await request(app).get('/api/applications/me').set(seeker.auth);

    expect(res.status).toBe(200);
    expect(res.body.applications.map((a) => a.job.title).sort()).toEqual(['Backend Engineer', 'Frontend Developer']);
    expect(res.body.counts).toEqual({ total: 2, applied: 2, shortlisted: 0, rejected: 0 });
  });

  it('can check whether the user applied to one job (?job=)', async () => {
    const otherJob = await createJob(recruiter.user, { title: 'Backend Engineer' });
    await apply(seeker.auth);

    const applied = await request(app).get(`/api/applications/me?job=${job._id}`).set(seeker.auth);
    const notApplied = await request(app).get(`/api/applications/me?job=${otherJob._id}`).set(seeker.auth);

    expect(applied.body.applications).toHaveLength(1);
    expect(notApplied.body.applications).toHaveLength(0);
  });

  it('is only for job seekers', async () => {
    const res = await request(app).get('/api/applications/me').set(recruiter.auth);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/jobs/:id/applications', () => {
  it("shows the job's recruiter each applicant's public profile and email", async () => {
    await apply(seeker.auth);

    const res = await request(app).get(`/api/jobs/${job._id}/applications`).set(recruiter.auth);

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe('Frontend Developer');
    expect(res.body.counts.total).toBe(1);
    expect(res.body.applications[0].applicant).toMatchObject({
      name: 'Daniel Ong',
      email: seeker.user.email,
      headline: 'Full-stack developer',
      skills: ['React'],
    });
    expect(res.body.applications[0].applicant).not.toHaveProperty('passwordHash');
  });

  it("returns 403 for another recruiter's job and for job seekers", async () => {
    const other = await createRecruiter();

    const asOther = await request(app).get(`/api/jobs/${job._id}/applications`).set(other.auth);
    const asSeeker = await request(app).get(`/api/jobs/${job._id}/applications`).set(seeker.auth);

    expect(asOther.status).toBe(403);
    expect(asSeeker.status).toBe(403);
  });
});

describe('PATCH /api/applications/:id/status', () => {
  let applicationId;

  beforeEach(async () => {
    applicationId = (await apply(seeker.auth)).body.application._id;
  });

  const setStatus = (auth, status, id = applicationId) =>
    request(app).patch(`/api/applications/${id}/status`).set(auth).send({ status });

  it("lets the job's recruiter change the status, and the job seeker sees it", async () => {
    const res = await setStatus(recruiter.auth, 'shortlisted');
    const seekerView = await request(app).get('/api/applications/me').set(seeker.auth);

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('shortlisted');
    expect(seekerView.body.applications[0].status).toBe('shortlisted');
  });

  it('rejects unknown statuses', async () => {
    const res = await setStatus(recruiter.auth, 'hired');

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('status');
  });

  it("returns 403 for another recruiter and for the applicant; status doesn't change", async () => {
    const other = await createRecruiter();

    const asOther = await setStatus(other.auth, 'rejected');
    const asApplicant = await setStatus(seeker.auth, 'shortlisted');

    expect(asOther.status).toBe(403);
    expect(asApplicant.status).toBe(403);
    expect((await Application.findById(applicationId)).status).toBe('applied');
  });

  it('returns 404 for an application that does not exist', async () => {
    const res = await setStatus(recruiter.auth, 'rejected', '000000000000000000000000');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/applications/:id/resume', () => {
  let applicationId;

  beforeEach(async () => {
    applicationId = (await apply(seeker.auth)).body.application._id;
  });

  const download = (auth) =>
    request(app).get(`/api/applications/${applicationId}/resume`).set(auth).buffer(true).parse(binaryParser);

  it.each([
    ['the applicant', () => seeker.auth],
    ["the job's recruiter", () => recruiter.auth],
  ])('lets %s download the exact file that was uploaded', async (_, getAuth) => {
    const res = await download(getAuth());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-disposition']).toContain('Daniel Resume.pdf');
    expect(Buffer.compare(res.body, pdfFile)).toBe(0);
  });

  it('returns 403 for other job seekers and other recruiters, 401 without a token', async () => {
    const otherSeeker = await createJobSeeker();
    const otherRecruiter = await createRecruiter();

    expect((await download(otherSeeker.auth)).status).toBe(403);
    expect((await download(otherRecruiter.auth)).status).toBe(403);
    expect((await request(app).get(`/api/applications/${applicationId}/resume`)).status).toBe(401);
  });
});
