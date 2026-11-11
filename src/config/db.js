/**
 * MongoDB connection helpers (via Mongoose).
 *
 * Mongoose keeps one shared connection pool for the whole process, so we
 * connect once at startup (in server.js) and every model reuses it.
 */
const mongoose = require('mongoose');

async function connectDB(uri) {
  // Log connection problems that happen after startup (e.g. the DB restarts).
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  // Give up after 10s instead of hanging if the DB is unreachable.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  // Mongoose builds schema indexes in the background after connecting. Wait
  // for them so the first requests can rely on them (the unique email index,
  // and the text index that keyword search needs).
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
