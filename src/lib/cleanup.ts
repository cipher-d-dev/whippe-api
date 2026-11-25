import { deleteExpiredPendingAccounts } from '../modules/users/users.service';
import { deleteExpiredFaceData } from '../modules/face/face.service';
import { deleteExpiredChats, sendUnreadNudges } from '../modules/chat/chat.service';

// Run cleanup every 24 hours
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let nudgeTimer: ReturnType<typeof setInterval> | null = null;

/** Unread-chat emails are checked every 30 minutes (while the server is awake). */
const NUDGE_INTERVAL_MS = 30 * 60 * 1000;
async function runNudges(): Promise<void> {
  try {
    const sent = await sendUnreadNudges();
    if (sent > 0) console.log(`💬  Emailed ${sent} person(s) about unread chat messages`);
  } catch (err) {
    console.error('Chat nudge job error:', err);
  }
}

async function runCleanup(): Promise<void> {
  try {
    const deleted = await deleteExpiredPendingAccounts();
    if (deleted > 0) {
      console.log(`🧹  Cleanup: deleted ${deleted} expired pending account(s)`);
    }
    const faceItems = await deleteExpiredFaceData();
    if (faceItems > 0) {
      console.log(`🧹  Cleanup: deleted ${faceItems} face photo(s)/selfie(s) of interns who finished over 30 days ago`);
    }
    const chatItems = await deleteExpiredChats();
    if (chatItems > 0) {
      console.log(`🧹  Cleanup: deleted ${chatItems} chat message(s) of interns who finished over 30 days ago`);
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

  nudgeTimer = setInterval(() => void runNudges(), NUDGE_INTERVAL_MS);
  if (nudgeTimer.unref) nudgeTimer.unref();

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
  if (nudgeTimer) {
    clearInterval(nudgeTimer);
    nudgeTimer = null;
  }
}
