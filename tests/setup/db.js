/**
 * Database lifecycle for every test file:
 * connect once, empty all collections after each test, drop the database at the end.
 */
const mongoose = require('mongoose');
require('../../src/app'); // loads every model, so their indexes can be built below

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  // Build indexes (unique email, text search, one application per job...)
  // before any test relies on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

// Each test starts from an empty database. Documents are deleted rather than
// the database being dropped, so the indexes built above stay in place.
afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
