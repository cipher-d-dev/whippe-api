/**
 * Runs the supervisor re-invitation against a small fake database.
 */
type Doc = Record<string, any>;
const db: { users: Doc[]; supervisors: Doc[] } = { users: [], supervisors: [] };
const withSave = (d: Doc) => Object.assign(d, { save: jest.fn(async () => d) });

jest.mock('../../src/modules/users/user.model', () => ({
  User: {
    findOne: jest.fn(async (q: any) => db.users.find((u) => u.email === q.email) ?? null),
    findById: jest.fn(async (id: any) => db.users.find((u) => u._id === id) ?? null),
  },
}));
jest.mock('../../src/modules/supervisors/supervisor.model', () => ({
  Supervisor: {
    find: jest.fn((q: any) => ({ populate: async () => db.supervisors.filter((s) => s.isActive === q.isActive) })),
  },
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../src/lib/urls', () => ({ staffPortalUrl: () => 'https://staff.example.com' }));

import bcrypt from 'bcryptjs';
import { up, setSendGap } from '../../src/migrations/2026-11-supervisor-reinvite';
import { sendEmail } from '../../src/lib/email';

function addSup(id: string, email: string, extra: Doc = {}, active = true) {
  db.users.push(withSave({ _id: id, email, role: 'SUPERVISOR', authMethod: 'PASSWORD', status: 'ACTIVE', passwordHash: 'old', ...extra }));
  db.supervisors.push({ _id: `s-${id}`, user: id, firstName: `F${id}`, lastName: 'L', isActive: active, departments: [{ name: 'ICT UNIT' }, { name: 'ENGINEERING' }] });
}

describe('2026-11 supervisor re-invitation', () => {
  beforeAll(() => {
    setSendGap(0);
    addSup('u1', 'tallex8@gmail.com');
    addSup('u2', 'adediwuraadebayo1@yahoo.com', { status: 'PENDING_HR_VERIFICATION' });
    addSup('u3', 'someone@yahoo.com');
    addSup('u4', 'google@gmail.com', { authMethod: 'GOOGLE' });
    addSup('u5', 'left@gmail.com', {}, false);
  });

  it('changes the two emails and invites every active password supervisor', async () => {
    const log: string[] = [];
    await up((l) => log.push(l));

    expect(db.users.find((u) => u._id === 'u1')!.email).toBe('tallex7@gmail.com');
    expect(db.users.find((u) => u._id === 'u2')!.email).toBe('adebayoadediwura83@gmail.com');
    expect(db.users.find((u) => u._id === 'u2')!.status).toBe('ACTIVE');

    const calls = (sendEmail as jest.Mock).mock.calls.map((c) => c[0]);
    const preview = calls.shift();
    expect(preview.to).toBe('favitech009@gmail.com');
    expect(preview.text).toContain('sample000000');
    expect(calls.map((c) => c.to).sort()).toEqual(['adebayoadediwura83@gmail.com', 'someone@yahoo.com', 'tallex7@gmail.com']);
    expect(calls[0].subject).toBe('Please accept your invitation to Whippie');
    expect(calls[0].text).toContain('https://staff.example.com/login');
    expect(calls[0].text).toContain('do not need to sign up');
    expect(calls[0].text).toContain('ICT UNIT, ENGINEERING');

    // The password in the email is the one that now works.
    const joshua = calls.find((c) => c.to === 'tallex7@gmail.com');
    const pw = /Temporary password: (\w+)/.exec(joshua.text)![1];
    expect(await bcrypt.compare(pw, db.users.find((u) => u._id === 'u1')!.passwordHash)).toBe(true);

    expect(db.users.find((u) => u._id === 'u4')!.passwordHash).toBe('old');
    expect(log.some((l) => l.includes('signs in with Google'))).toBe(true);
    expect(log.at(-1)).toContain('3 invited');
  });

  it('a second run leaves the emails alone', async () => {
    const log: string[] = [];
    (sendEmail as jest.Mock).mockClear();
    await up((l) => log.push(l));
    expect(log.filter((l) => l.includes('already in place'))).toHaveLength(2);
  });
});
