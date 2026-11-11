/**
 * Profiles: editing your profile and managing your profile resume (/api/users/me).
 */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createJobSeeker, createRecruiter, pdfFile, asPdf, binaryParser, countStoredFiles } = require('./helpers');

describe('PUT /api/users/me', () => {
  it('updates the profile and removes duplicate skills', async () => {
    const { auth } = await createJobSeeker();

    const res = await request(app)
      .put('/api/users/me')
      .set(auth)
      .send({ name: ' Asha Tan ', headline: 'Frontend developer', location: 'Singapore', skills: ['React', 'react', 'CSS'] });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Asha Tan',
      headline: 'Frontend developer',
      location: 'Singapore',
      skills: ['React', 'CSS'],
    });
  });

  it('clears optional fields that are left out (PUT replaces)', async () => {
    const { auth } = await createJobSeeker({ headline: 'Old headline', skills: ['Old'] });

    const res = await request(app).put('/api/users/me').set(auth).send({ name: 'New Name' });

    expect(res.body.user).toMatchObject({ headline: '', location: '', skills: [] });
  });

  it('cannot change email, role or password', async () => {
    const { user, auth } = await createJobSeeker();

    await request(app)
      .put('/api/users/me')
      .set(auth)
      .send({ name: 'Sneaky', email: 'new@example.com', role: 'recruiter', passwordHash: 'x' });

    const stored = await User.findById(user._id).select('+passwordHash');
    expect(stored).toMatchObject({ email: user.email, role: 'job_seeker' });
    expect(stored.passwordHash).not.toBe('x');
  });

  it('validates the input', async () => {
    const { auth } = await createJobSeeker();

    const res = await request(app)
      .put('/api/users/me')
      .set(auth)
      .send({ name: '', headline: 'x'.repeat(151), skills: [42] });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['headline', 'name', 'skills[0]']);
  });

  it('works for recruiters too, and requires login', async () => {
    const { auth } = await createRecruiter();

    const asRecruiter = await request(app).put('/api/users/me').set(auth).send({ name: 'Rachel Lim' });
    const anonymous = await request(app).put('/api/users/me').send({ name: 'Nobody' });

    expect(asRecruiter.status).toBe(200);
    expect(anonymous.status).toBe(401);
  });
});

describe('profile resume (/api/users/me/resume)', () => {
  const upload = (auth, filename = 'My CV.pdf') =>
    request(app).post('/api/users/me/resume').set(auth).attach('resume', pdfFile, asPdf(filename));

  it('uploads a resume and shows it on the user', async () => {
    const { auth } = await createJobSeeker();

    const res = await upload(auth);
    const me = await request(app).get('/api/auth/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.user.resume).toMatchObject({ filename: 'My CV.pdf', size: pdfFile.length });
    expect(res.body.user.resume).not.toHaveProperty('fileId');
    expect(me.body.user.resumeUrl).toBe('/api/users/me/resume');
  });

  it('replaces the previous resume and deletes its file', async () => {
    const { auth } = await createJobSeeker();
    await upload(auth, 'First.pdf');

    const res = await upload(auth, 'Second.pdf');

    expect(res.body.user.resume.filename).toBe('Second.pdf');
    expect(await countStoredFiles()).toBe(1);
  });

  it('downloads your own resume', async () => {
    const { auth } = await createJobSeeker();
    await upload(auth);

    const res = await request(app).get('/api/users/me/resume').set(auth).buffer(true).parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(res.body, pdfFile)).toBe(0);
  });

  it('removes the resume and its file', async () => {
    const { auth } = await createJobSeeker();
    await upload(auth);

    const res = await request(app).delete('/api/users/me/resume').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty('resume');
    expect(res.body.user.resumeUrl).toBeNull();
    expect(await countStoredFiles()).toBe(0);
  });

  it('returns 404 when there is no resume to download or remove', async () => {
    const { auth } = await createJobSeeker();

    expect((await request(app).get('/api/users/me/resume').set(auth)).status).toBe(404);
    expect((await request(app).delete('/api/users/me/resume').set(auth)).status).toBe(404);
  });

  it('returns 400 when no file is attached', async () => {
    const { auth } = await createJobSeeker();

    const res = await request(app).post('/api/users/me/resume').set(auth);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'resume', message: 'Attach your resume as a PDF' }]);
  });

  it('rejects non-PDF files', async () => {
    const { auth } = await createJobSeeker();

    const res = await request(app)
      .post('/api/users/me/resume')
      .set(auth)
      .attach('resume', Buffer.from('plain text'), asPdf('fake.pdf'));

    expect(res.status).toBe(400);
    expect(await countStoredFiles()).toBe(0);
  });

  it('is only for job seekers', async () => {
    const { auth } = await createRecruiter();

    const res = await upload(auth);

    expect(res.status).toBe(403);
  });
});
