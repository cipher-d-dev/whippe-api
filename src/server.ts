import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startCleanupJob, stopCleanupJob } from './lib/cleanup';
import { ensureDefaultHR } from './config/seed';
import app from './app';

// ─── Startup env-var audit ────────────────────────────────────────────────────

function auditEnv(): void {
  interface VarAudit { name: string; set: boolean; impact: string }

  const vars: VarAudit[] = [
    // ── Core (already validated by Zod in env.ts — these should never be missing) ──
    { name: 'MONGODB_URI',         set: !!process.env['MONGODB_URI'],         impact: 'Database connection — app will not start' },
    { name: 'JWT_SECRET',          set: !!process.env['JWT_SECRET'],           impact: 'All auth tokens — app will not start' },
    { name: 'FRONTEND_URL',        set: !!process.env['FRONTEND_URL'],         impact: 'OAuth redirects, email links — defaults to localhost:3000' },

    // ── Google OAuth ──────────────────────────────────────────────────────────
    { name: 'GOOGLE_CLIENT_ID',     set: !!process.env['GOOGLE_CLIENT_ID'],    impact: 'Google sign-in is completely broken' },
    { name: 'GOOGLE_CLIENT_SECRET', set: !!process.env['GOOGLE_CLIENT_SECRET'],impact: 'Google sign-in is completely broken' },
    { name: 'GOOGLE_CALLBACK_URL',  set: !!process.env['GOOGLE_CALLBACK_URL'], impact: 'Google sign-in is completely broken' },

    // ── Email (Mailtrap) ──────────────────────────────────────────────────────
    { name: 'MAILTRAP_TOKEN',       set: !!process.env['MAILTRAP_TOKEN'],      impact: 'All emails (verify, reset, welcome, rejected) are console-stubbed — not sent' },
    { name: 'EMAIL_FROM',           set: !!process.env['EMAIL_FROM'],          impact: 'Sender address — defaults to hello@isbmpa.com' },

    // ── Appwrite Storage ──────────────────────────────────────────────────────
    { name: 'APPWRITE_ENDPOINT',    set: !!process.env['APPWRITE_ENDPOINT'],   impact: 'Document upload/download fails with 500' },
    { name: 'APPWRITE_PROJECT_ID',  set: !!process.env['APPWRITE_PROJECT_ID'], impact: 'Document upload/download fails with 500' },
    { name: 'APPWRITE_BUCKET_ID',   set: !!process.env['APPWRITE_BUCKET_ID'],  impact: 'Document upload/download fails with 500' },
    { name: 'APPWRITE_API_KEY',     set: !!process.env['APPWRITE_API_KEY'],    impact: 'Document download (server proxy) fails with 500' },

    // ── Geofence ──────────────────────────────────────────────────────────────
    { name: 'OFFICE_LAT',           set: !!process.env['OFFICE_LAT'],          impact: 'Attendance geofence — defaults to placeholder coords' },
    { name: 'OFFICE_LNG',           set: !!process.env['OFFICE_LNG'],          impact: 'Attendance geofence — defaults to placeholder coords' },

    // ── Web Push ──────────────────────────────────────────────────────────────
    { name: 'VAPID_PUBLIC_KEY',     set: !!process.env['VAPID_PUBLIC_KEY'],    impact: 'Push notifications disabled — interns will only get in-app polling' },
    { name: 'VAPID_PRIVATE_KEY',    set: !!process.env['VAPID_PRIVATE_KEY'],   impact: 'Push notifications disabled' },
    { name: 'VAPID_SUBJECT',        set: !!process.env['VAPID_SUBJECT'],       impact: 'Push notifications disabled' },
  ];

  const missing = vars.filter((v) => !v.set);

  if (missing.length === 0) {
    console.log('✅  All environment variables are set.\n');
    return;
  }

  console.warn(`\n⚠️   [ENV] ${missing.length} variable(s) not set:`);
  missing.forEach((v) => {
    console.warn(`   ✗  ${v.name.padEnd(24)} → ${v.impact}`);
  });
  console.warn('\n   Fill these in .env — see .env.example for instructions.\n');
}

async function start(): Promise<void> {
  // Print env audit before anything else
  auditEnv();
  await connectDatabase();

  // Ensure default HR admin exists in production / initial setup
  await ensureDefaultHR().catch((err) => {
    console.warn('⚠️  Could not seed initial HR account:', err);
  });

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
