/**
 * Entry point: connect to MongoDB, then start the HTTP server.
 *
 * We connect to the database BEFORE listening so the API never accepts
 * requests it can't serve. If the DB is unreachable we exit with a non-zero
 * code so the hosting platform knows the deploy failed.
 */
const config = require('./config/env');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

async function start() {
  await connectDB(config.mongoUri);

  const server = app.listen(config.port, () => {
    console.log(`JobConnect API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown: on Ctrl+C or a platform stop signal, finish in-flight
  // requests and close the DB connection cleanly before exiting.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
