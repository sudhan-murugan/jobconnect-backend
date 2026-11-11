/**
 * Test environment variables. These are set before the app's config is loaded;
 * dotenv never overrides variables that already exist, so values from a
 * developer's .env file can't leak into tests.
 */
process.env.NODE_ENV = 'test'; // also disables request logging and rate limiting
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4'; // the minimum: keeps password hashing fast in tests

// Jest runs test files in parallel worker processes. Giving each worker its
// own database means tests in different files never see each other's data.
process.env.MONGODB_URI = `${process.env.MONGODB_TEST_URI}jobconnect_test_${process.env.JEST_WORKER_ID}`;
