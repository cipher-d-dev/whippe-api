/**
 * Runs the 2026-11 roster update against a small fake database (twice) to check
 * what it changes, and that a second run changes nothing.
 */
type Doc = Record<string, any>;
const db: { departments: Doc[]; users: Doc[]; supervisors: Doc[] } = { departments: [], users: [], supervisors: [] };
let seq = 0;
const oid = () => `id${++seq}`;
const withSave = (d: Doc) => Object.assign(d, { save: jest.fn(async () => d) });
const nameMatch = (q: any) => (d: Doc) => new RegExp(q.name.$regex, q.name.$options).test(d.name);

jest.mock('../../src/modules/departments/department.model', () => ({
  Department: {
    findOne: jest.fn(async (q: any) => db.departments.find(nameMatch(q)) ?? null),
    create: jest.fn(async (d: Doc) => { const doc = withSave({ _id: oid(), ...d }); db.departments.push(doc); return doc; }),
  },
}));
jest.mock('../../src/modules/users/user.model', () => ({
  User: {
    findOne: jest.fn((q: any) => {
      const found = q.role ? db.users.find((u) => u.role === q.role) : db.users.find((u) => u.email === q.email);
      const p: any = Promise.resolve(found ?? null);
      p.sort = () => Promise.resolve(found ?? null);
      return p;
    }),
  },
}));
jest.mock('../../src/modules/supervisors/supervisor.model', () => ({
  Supervisor: {
    findOne: jest.fn(async (q: any) => db.supervisors.find((s) => s.user === q.user) ?? null),
    updateMany: jest.fn(async () => ({ modifiedCount: 0 })),
  },
}));
jest.mock('../../src/modules/supervisors/supervisor.service', () => ({
  createSupervisor: jest.fn(async (input: Doc) => {
    const user = withSave({ _id: oid(), email: input.email, role: 'SUPERVISOR' });
    db.users.push(user);
    return { departments: input.departments };
  }),
}));
jest.mock('../../src/modules/users/users.service', () => ({
  inviteHr: jest.fn(async (input: Doc) => { db.users.push(withSave({ _id: oid(), email: input.email, role: 'HR' })); }),
}));

import { up, ROSTER } from '../../src/migrations/2026-11-roster';
import { createSupervisor } from '../../src/modules/supervisors/supervisor.service';
import { inviteHr } from '../../src/modules/users/users.service';

function seed() {
  db.users.push(withSave({ _id: 'hr1', email: 'hr@example.com', role: 'HR' }));
  for (const name of ['NEWS DEPARTMENT', 'DVSL/PRODUCTION', 'FAAJI FM', 'ENGINEERING SERVICES', 'ICT UNIT, ENGINEERING SERVICES',
    'RAYPOWER PROGRAMMES & PRODUCTION', 'RAYPOWER ONLINE UNIT', 'MARKETING & SALES DEPARTMENT/ADVERT TRAFFIC UNIT',
    'MARKETING & SALES DEPARTMENT', 'MARKETING & SALES DEPARTMENT/MONITORING UNIT', 'FINANCE & ACCOUNTS', 'INTERNAL AUDIT']) {
    db.departments.push(withSave({ _id: oid(), name, subsidiary: name === 'NEWS DEPARTMENT' ? 'AIT' : 'X' }));
  }
  // Every rostered supervisor except one, to check missing people are skipped.
  for (const email of Object.keys(ROSTER).filter((e) => e !== 'said2sas@gmail.com')) {
    const u = withSave({ _id: oid(), email, role: 'SUPERVISOR', lastName: email === 'dolamide99@yahoo.com' ? 'Olamide' : 'X' });
    db.users.push(u);
    db.supervisors.push(withSave({ _id: oid(), user: u._id, firstName: 'F', lastName: u.lastName, departments: [] }));
  }
}

const dept = (n: string) => db.departments.find((d) => d.name === n);
const supOf = (email: string) => db.supervisors.find((s) => s.user === db.users.find((u) => u.email === email)?._id);

describe('2026-11 roster update', () => {
  beforeAll(seed);

  it('applies HR roster', async () => {
    const log: string[] = [];
    await up((l) => log.push(l));

    expect(db.departments.find((d) => d.name === 'NEWS DEPARTMENT')).toBeUndefined();
    expect(dept('DAAR NEWS SERVICES (DNS)')?.subsidiary).toBe('DAAR Corporate');
    for (const n of ['DVSL/EDITING SUITE UNIT', 'DVSL/CAMERA UNIT', 'ADMINISTRATION/HRD', 'CORPORATE COMMUNICATIONS']) {
      expect(dept(n)).toBeDefined();
    }

    const esh = supOf('ellamswahid@gmail.com')!;
    expect(esh.departments).toEqual([dept('DVSL/PRODUCTION')!._id, dept('DVSL/EDITING SUITE UNIT')!._id, dept('DVSL/CAMERA UNIT')!._id]);
    expect(esh.department).toBe(dept('DVSL/PRODUCTION')!._id);
    expect(supOf('ayobamidele67.moaj@gmail.com')!.departments).toEqual([dept('DVSL/CAMERA UNIT')!._id]);
    expect(supOf('dolamide99@yahoo.com')!.lastName).toBe('Adekunle');

    expect(log.some((l) => l.includes('Skipped said2sas@gmail.com'))).toBe(true);
    expect(inviteHr).toHaveBeenCalledTimes(1);
    expect((inviteHr as jest.Mock).mock.calls[0][0].email).toBe('cindymaxuduma@yahoo.com');
    expect(createSupervisor).toHaveBeenCalledTimes(1);
    const sup = (createSupervisor as jest.Mock).mock.calls[0][0];
    expect(sup.email).toBe('cindymaxuduma@gmail.com');
    expect(sup.departments).toEqual([String(dept('ADMINISTRATION/HRD')!._id), String(dept('CORPORATE COMMUNICATIONS')!._id)]);
  });

  it('changes nothing and emails nobody when run again', async () => {
    const before = db.departments.length;
    (inviteHr as jest.Mock).mockClear();
    (createSupervisor as jest.Mock).mockClear();
    await up(() => undefined);
    expect(db.departments.length).toBe(before);
    expect(inviteHr).not.toHaveBeenCalled();
    expect(createSupervisor).not.toHaveBeenCalled();
  });
});
