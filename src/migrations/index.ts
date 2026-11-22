import { env } from '../config/env';
import { Migration } from './migration.model';
import * as roster2026Nov from './2026-11-roster';

/**
 * One-time data updates, run in order when the API starts.
 * Each is recorded in the `migrations` collection after it succeeds and never runs again.
 *
 * Safety:
 * - Only on the live server (NODE_ENV=production), or when RUN_MIGRATIONS=true,
 *   so a laptop pointing at a local database never sends real emails.
 * - Not until ADMIN_URL is set, so invitation links can't point at the wrong app.
 * - A failure is logged and retried on the next start; the API still starts.
 */
const MIGRATIONS = [roster2026Nov];

export async function runMigrations(): Promise<void> {
  const enabled = env.NODE_ENV === 'production' || process.env['RUN_MIGRATIONS'] === 'true';
  if (!enabled) return;
  if (!env.ADMIN_URL) {
    console.warn('⚠️  [migrations] ADMIN_URL is not set. One-time updates (and their invitation emails) are waiting until it is.');
    return;
  }

  for (const m of MIGRATIONS) {
    if (await Migration.exists({ name: m.name })) continue;
    const lines: string[] = [];
    const log = (line: string) => {
      lines.push(line);
      console.log(`   [${m.name}] ${line}`);
    };
    try {
      console.log(`🛠   Running one-time update ${m.name}`);
      await m.up(log);
      await Migration.create({ name: m.name, ranAt: new Date(), log: lines });
      console.log(`✅  ${m.name} done`);
    } catch (err) {
      console.error(`❌  ${m.name} failed; it will retry on the next start:`, err);
      return;
    }
  }
}
