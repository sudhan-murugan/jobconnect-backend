/**
 * Authentication: register, login and the current user (/api/auth).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const { createJobSeeker } = require('./helpers');

const validRegistration = {
  name: 'Asha Tan',
  email: 'Asha@Example.com',
  password: 'secret123',
  role: 'job_seeker',
};

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token and the user', async () => {
    const res = await request(app).post('/api/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Asha Tan', email: 'asha@example.com', role: 'job_seeker' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('stores only a bcrypt hash of the password', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);

    const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain('secret123');
  });

  it("returns a token whose subject is the new user's id", async () => {
    const res = await request(app).post('/api/auth/register').send(validRegistration);

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.sub).toBe(res.body.user._id);
  });

  it('can register a recruiter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'hr@example.com', role: 'recruiter' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('recruiter');
  });

  it('rejects invalid input with an error for each field', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short', role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password', 'role']);
  });

  it('requires a password with a letter and a number', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, password: 'onlyletters' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'password', message: 'Password must contain a number' }]);
  });

  it('returns 409 when the email is already registered, ignoring case', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'ASHA@example.COM' });

    expect(res.status).toBe(409);
    expect(await User.countDocuments()).toBe(1);
  });

  it('ignores fields a client must not set (mass assignment)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, passwordHash: 'hacked', resume: { fileId: 'x' }, headline: 'extra' });

    expect(res.status).toBe(201);
    const stored = await User.findById(res.body.user._id).select('+passwordHash');
    expect(stored.passwordHash).not.toBe('hacked');
    expect(stored.resume).toBeUndefined();
    expect(stored.headline).toBe('');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validRegistration);
  });

  it('logs in with the right password (email is case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ASHA@example.com ', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('asha@example.com');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'asha@example.com', password: 'wrongpass1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpass1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Same message, so attackers can't find out which emails are registered.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'password']);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const { user, auth } = await createJobSeeker({ name: 'Daniel Ong' });

    const res = await request(app).get('/api/auth/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ _id: user._id.toString(), name: 'Daniel Ong', resumeUrl: null });
  });

  it.each([
    ['no Authorization header', {}],
    ['a non-Bearer scheme', { Authorization: 'Basic abc123' }],
    ['a malformed token', { Authorization: 'Bearer not.a.jwt' }],
  ])('returns 401 with %s', async (_, headers) => {
    const res = await request(app).get('/api/auth/me').set(headers);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const { user } = await createJobSeeker();
    const forged = jwt.sign({ sub: user._id.toString() }, 'some-other-secret');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const { user } = await createJobSeeker();
    const expired = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: -10 });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a token without a subject', async () => {
    const noSubject = jwt.sign({}, process.env.JWT_SECRET);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${noSubject}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 once the user has been deleted', async () => {
    const { user, auth } = await createJobSeeker();
    await User.deleteOne({ _id: user._id });

    const res = await request(app).get('/api/auth/me').set(auth);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User no longer exists');
  });
});
