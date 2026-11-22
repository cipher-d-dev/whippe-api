jest.mock('../../src/migrations/migration.model', () => ({ Migration: { exists: jest.fn(), create: jest.fn() } }));
jest.mock('../../src/migrations/2026-11-roster', () => ({ name: '2026-11-roster', up: jest.fn() }));

import { Migration } from '../../src/migrations/migration.model';
import * as roster from '../../src/migrations/2026-11-roster';
import { runMigrations } from '../../src/migrations';

describe('runMigrations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing outside production (no real emails from a laptop)', async () => {
    await runMigrations();
    expect(roster.up).not.toHaveBeenCalled();
    expect(Migration.exists).not.toHaveBeenCalled();
  });
});

describe('roster data', () => {
  it('covers every supervisor HR listed, with lower-case emails', () => {
    const actual = jest.requireActual('../../src/migrations/2026-11-roster') as typeof roster;
    const emails = Object.keys(actual.ROSTER);
    expect(emails).toHaveLength(23);
    expect(emails.every((e) => e === e.toLowerCase())).toBe(true);
    expect(actual.ROSTER['ellamswahid@gmail.com']).toEqual([
      'DVSL/PRODUCTION', 'DVSL/EDITING SUITE UNIT', 'DVSL/CAMERA UNIT',
    ]);
  });
});
