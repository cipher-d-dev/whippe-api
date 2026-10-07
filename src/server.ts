import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startCleanupJob, stopCleanupJob } from './lib/cleanup';
import app from './app';

async function start(): Promise<void> {
  await connectDatabase();

  // Start background jobs after DB is connected
  startCleanupJob();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀  Whippe API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    console.log(`\n${signal} received — shutting down gracefully`);
    stopCleanupJob();
    server.close(async () => {
      await disconnectDatabase();
      console.log('Server closed');
      process.exit(0);
    });

    // Force-exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
}

start();
