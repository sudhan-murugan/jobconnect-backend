// Stops the in-memory MongoDB server once all test files have finished.
module.exports = async function globalTeardown() {
  await globalThis.__MONGOD__?.stop();
};
