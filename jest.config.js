/**
 * Jest configuration (backend tests).
 *
 * Tests run against a throwaway in-memory MongoDB (mongodb-memory-server):
 * no database to install, and no risk of touching real data.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  // Runs once before all test files: starts the in-memory MongoDB server.
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  // Runs in each test file before anything else: test environment variables.
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  // Runs in each test file after Jest loads: connect, clean up between tests.
  setupFilesAfterEnv: ['<rootDir>/tests/setup/db.js'],

  // Uploads and password hashing can be slow on CI machines.
  testTimeout: 15000,

  // `npm run test:coverage` measures how much of src/ the tests exercise.
  // server.js and config/db.js only run when the real server starts (tests use
  // their own connection, see tests/setup/db.js); docs/ is static data.
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/db.js', '!src/docs/**'],
  coverageThreshold: {
    global: { statements: 90, branches: 80, functions: 90, lines: 90 },
  },
};
