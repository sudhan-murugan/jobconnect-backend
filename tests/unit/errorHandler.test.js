/**
 * Unit tests for the central error handler: how library errors become HTTP
 * responses, and that internal details are hidden in production.
 */
const mongoose = require('mongoose');
const Job = require('../../src/models/Job');
const ApiError = require('../../src/utils/ApiError');

// A minimal stand-in for Express's `res` that records what was sent.
function mockResponse() {
  const res = {};
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

function handle(err, errorHandler = require('../../src/middleware/error').errorHandler) {
  const res = mockResponse();
  errorHandler(err, {}, res, jest.fn());
  return res;
}

describe('errorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {}); // 500s are logged; keep test output clean
  });
  afterEach(() => jest.restoreAllMocks());

  it('passes ApiError status, message and details through', () => {
    const res = handle(new ApiError(422, 'Nope', [{ field: 'x', message: 'bad' }]));

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ message: 'Nope', details: [{ field: 'x', message: 'bad' }] });
  });

  it('turns a Mongoose validation error into 400 with full field paths', async () => {
    const err = await new Job({ salaryRange: { min: 10, max: 1 } }).validate().catch((e) => e);

    const res = handle(err);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['title', 'salaryRange.max']));
  });

  it('turns an invalid ObjectId (CastError) into 400', () => {
    const err = new mongoose.Error.CastError('ObjectId', 'abc', '_id');

    const res = handle(err);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid value for _id');
  });

  it('turns a duplicate-key error into 409', () => {
    const res = handle(Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: 'a@b.c' } }));

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('email already exists');
  });

  it('returns 500 with the message and stack outside production', () => {
    const res = handle(new Error('Something broke'));

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Something broke');
    expect(res.body.stack).toEqual(expect.any(String));
  });

  it('hides internal error details in production', () => {
    let res;
    // Load the handler with a production config, without affecting other tests.
    jest.isolateModules(() => {
      jest.doMock('../../src/config/env', () => ({ isProduction: true, isTest: false }));
      res = handle(new Error('Database password is hunter2'), require('../../src/middleware/error').errorHandler);
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error' });
  });
});
