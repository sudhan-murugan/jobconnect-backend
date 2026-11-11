/**
 * Starts one in-memory MongoDB server for the whole test run.
 * (The first run downloads a MongoDB binary, which is then cached.)
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  // Kept for globalTeardown, which runs in this same process.
  globalThis.__MONGOD__ = mongod;
  // Environment variables set here are inherited by the test workers.
  process.env.MONGODB_TEST_URI = mongod.getUri();
};
