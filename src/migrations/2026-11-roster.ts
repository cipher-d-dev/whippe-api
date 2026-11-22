/**
 * One-time update from HR's department & supervisor roster (22 Nov 2026).
 *
 * - Renames NEWS DEPARTMENT to DAAR NEWS SERVICES (DNS), station DAAR Corporate.
 * - Adds DVSL/EDITING SUITE UNIT, DVSL/CAMERA UNIT, ADMINISTRATION/HRD and
 *   CORPORATE COMMUNICATIONS.
 * - Puts every existing supervisor in the departments HR listed (some cover
 *   several), and corrects David Olamide's surname to Adekunle.
 * - Creates Cindy Uduma's logins and emails her: HR on her yahoo address,
 *   supervisor (Administration/HRD + Corporate Communications) on her gmail.
 *
 * Every step checks first, so running it twice changes nothing.
 * Supervisors are matched by the email already on their account; anyone not
 * found is skipped and noted in the log.
 */
import mongoose from 'mongoose';
import { Department } from '../modules/departments/department.model';
import { Supervisor } from '../modules/supervisors/supervisor.model';
import { User } from '../modules/users/user.model';
import { Role } from '../modules/auth/auth.types';
import { createSupervisor } from '../modules/supervisors/supervisor.service';
import { inviteHr } from '../modules/users/users.service';

export const name = '2026-11-roster';

const CORPORATE = 'DAAR Corporate';

const D = {
  RAYPOWER_PROG: 'RAYPOWER PROGRAMMES & PRODUCTION',
  FAAJI: 'FAAJI FM',
  DNS: 'DAAR NEWS SERVICES (DNS)',
  ENGINEERING: 'ENGINEERING SERVICES',
  ICT: 'ICT UNIT, ENGINEERING SERVICES',
  RAYPOWER_ONLINE: 'RAYPOWER ONLINE UNIT',
  ADVERT_TRAFFIC: 'MARKETING & SALES DEPARTMENT/ADVERT TRAFFIC UNIT',
  MARKETING: 'MARKETING & SALES DEPARTMENT',
  MONITORING: 'MARKETING & SALES DEPARTMENT/MONITORING UNIT',
  FINANCE: 'FINANCE & ACCOUNTS',
  AUDIT: 'INTERNAL AUDIT',
  PRODUCTION: 'DVSL/PRODUCTION',
  EDITING: 'DVSL/EDITING SUITE UNIT',
  CAMERA: 'DVSL/CAMERA UNIT',
  ADMIN_HRD: 'ADMINISTRATION/HRD',
  CORP_COMMS: 'CORPORATE COMMUNICATIONS',
} as const;

const NEW_DEPARTMENTS: { name: string; subsidiary: string; description?: string }[] = [
  { name: D.EDITING, subsidiary: 'AIT', description: 'Editing suite, DVSL/Production' },
  { name: D.CAMERA, subsidiary: 'AIT', description: 'Camera unit, DVSL/Production' },
  { name: D.ADMIN_HRD, subsidiary: CORPORATE },
  { name: D.CORP_COMMS, subsidiary: CORPORATE },
];

/** Existing supervisors by account email → departments from HR's roster. */
export const ROSTER: Record<string, string[]> = {
  'atumauzoma@gmail.com': [D.RAYPOWER_PROG],
  'adejumok84@gmail.com': [D.FAAJI],
  'loab1014u2meet77@gmail.com': [D.FAAJI],
  'nkoliemenari2000@yahoo.co.uk': [D.DNS],
  'aberuagbabiola1@gmail.com': [D.DNS],
  'beckleyabiola@gmail.com': [D.DNS],
  'obinnaume341@gmail.com': [D.DNS],
  'greg_ugbodaga2@yahoo.com': [D.ENGINEERING, D.ICT],
  'tallex8@gmail.com': [D.ICT],
  'adexmotty@gmail.com': [D.RAYPOWER_ONLINE],
  'okhueleigbejamesa@gmail.com': [D.RAYPOWER_ONLINE],
  'deblossom12002@gmail.com': [D.ADVERT_TRAFFIC],
  'tesyabey17@gmail.com': [D.ADVERT_TRAFFIC],
  'omorodionchristy@gmail.com': [D.ADVERT_TRAFFIC],
  'febije@yahoo.com': [D.MARKETING, D.MONITORING],
  'ellams3@yahoo.com': [D.MARKETING],
  'said2sas@gmail.com': [D.MONITORING],
  'ogunlade.johnson@yahoo.com': [D.FINANCE],
  'dolamide99@yahoo.com': [D.FINANCE],
  'adediwuraadebayo1@yahoo.com': [D.AUDIT],
  'christophereal1@yahoo.com': [D.PRODUCTION, D.EDITING],
  'ellamswahid@gmail.com': [D.PRODUCTION, D.EDITING, D.CAMERA],
  'ayobamidele67.moaj@gmail.com': [D.CAMERA],
};

const RENAMES: Record<string, { lastName: string }> = {
  'dolamide99@yahoo.com': { lastName: 'Adekunle' },
};

const CINDY = {
  firstName: 'Cindy',
  lastName: 'Uduma',
  hrEmail: 'cindymaxuduma@yahoo.com',
  supervisorEmail: 'cindymaxuduma@gmail.com',
  departments: [D.ADMIN_HRD, D.CORP_COMMS],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byName = (n: string) => ({ name: { $regex: `^${esc(n)}$`, $options: 'i' } });

export async function up(log: (line: string) => void): Promise<void> {
  const hr = await User.findOne({ role: Role.HR }).sort({ createdAt: 1 });
  if (!hr) throw new Error('No HR account found to record as the author of these changes.');
  const actorId = String(hr._id);

  // ── Departments ────────────────────────────────────────────────────────────
  const dns = await Department.findOne(byName(D.DNS));
  const news = await Department.findOne(byName('NEWS DEPARTMENT'));
  if (!dns && news) {
    news.name = D.DNS;
    news.subsidiary = CORPORATE;
    await news.save();
    log(`Renamed NEWS DEPARTMENT → ${D.DNS} (${CORPORATE})`);
  } else if (!dns) {
    await Department.create({ name: D.DNS, subsidiary: CORPORATE, isActive: true, createdBy: hr._id });
    log(`Created ${D.DNS}`);
  }

  for (const d of NEW_DEPARTMENTS) {
    if (await Department.findOne(byName(d.name))) continue;
    await Department.create({ ...d, isActive: true, createdBy: hr._id });
    log(`Created ${d.name} (${d.subsidiary})`);
  }

  const deptId = async (n: string) => {
    const d = await Department.findOne(byName(n));
    if (!d) throw new Error(`Department missing: ${n}`);
    return d._id as mongoose.Types.ObjectId;
  };

  // ── Existing supervisors ───────────────────────────────────────────────────
  for (const [email, depts] of Object.entries(ROSTER)) {
    const user = await User.findOne({ email });
    const sup = user ? await Supervisor.findOne({ user: user._id }) : null;
    if (!user || !sup) {
      log(`Skipped ${email}: no supervisor account with that email`);
      continue;
    }
    const ids = await Promise.all(depts.map(deptId));
    sup.departments = ids;
    sup.department = ids[0];
    const rename = RENAMES[email];
    if (rename) {
      sup.lastName = rename.lastName;
      user.lastName = rename.lastName;
      await user.save();
    }
    await sup.save();
    log(`${sup.firstName} ${sup.lastName}: ${depts.join(', ')}`);
  }

  // Anyone else with a single department gets it copied into the new list.
  const backfill = await Supervisor.updateMany(
    { department: { $exists: true, $ne: null }, $or: [{ departments: { $exists: false } }, { departments: { $size: 0 } }] },
    [{ $set: { departments: ['$department'] } }],
  );
  if (backfill.modifiedCount) log(`Copied the main department into the list for ${backfill.modifiedCount} other supervisor(s)`);

  // ── Cindy Uduma ────────────────────────────────────────────────────────────
  const cindyHr = await User.findOne({ email: CINDY.hrEmail });
  if (!cindyHr) {
    await inviteHr({ firstName: CINDY.firstName, lastName: CINDY.lastName, email: CINDY.hrEmail }, actorId);
    log(`Created HR login for ${CINDY.hrEmail} and emailed the invitation`);
  } else {
    log(`${CINDY.hrEmail} already has a ${cindyHr.role} login; left as is`);
  }

  const cindySupUser = await User.findOne({ email: CINDY.supervisorEmail });
  if (!cindySupUser) {
    const ids = await Promise.all(CINDY.departments.map(deptId));
    await createSupervisor(
      {
        email: CINDY.supervisorEmail,
        firstName: CINDY.firstName,
        lastName: CINDY.lastName,
        departments: ids.map(String),
      },
      actorId,
    );
    log(`Created supervisor login for ${CINDY.supervisorEmail} (${CINDY.departments.join(', ')}) and emailed the invitation`);
  } else {
    log(`${CINDY.supervisorEmail} already has a ${cindySupUser.role} login; left as is`);
  }
}
