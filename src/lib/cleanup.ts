import { deleteExpiredPendingAccounts } from '../modules/users/users.service';

// Run cleanup every 24 hours
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function runCleanup(): Promise<void> {
  try {
    const deleted = await deleteExpiredPendingAccounts();
    if (deleted > 0) {
      console.log(`🧹  Cleanup: deleted ${deleted} expired pending account(s)`);
    }
  } catch (err) {
    // Log but do not crash the server — cleanup will retry on next interval
    console.error('Cleanup job error:', err);
  }
}

/**
 * startCleanupJob
 *
 * Runs an initial cleanup immediately on startup, then on a 24-hour interval.
 * Safe to call multiple times — will not start a second timer if already running.
 */
export function startCleanupJob(): void {
  if (cleanupTimer) return;

  // Run once immediately so expired accounts are cleared on every server restart
  void runCleanup();

  cleanupTimer = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);

  // Prevent the interval from keeping the process alive during graceful shutdown
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  console.log('🧹  Cleanup job started (interval: 24 h)');
}

/**
 * stopCleanupJob
 *
 * Clears the interval. Called during graceful shutdown.
 */
export function stopCleanupJob(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
