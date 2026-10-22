/**
 * seed.ts — development seed script
 *
 * Creates:
 *   - 1 HR user     (hr@whippe.dev / Password123!)
 *   - 1 Intern user (intern@whippe.dev / Password123!) — pre-approved, with intern record
 *
 * Run with:
 *   npx tsx scripts/seed.ts
 *
 * Safe to re-run — skips records that already exist.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Inline the models we need (avoids circular imports from app bootstrap) ───

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set in .env');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('✅  Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');

  const users = db.collection('users');
  const interns = db.collection('interns');
  const supervisors = db.collection('supervisors');
  const departments = db.collection('departments');

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const now = new Date();
  const farFuture = new Date('2099-01-01');

  // ─── Default Departments ────────────────────────────────────────────────────
  let newsDeptId: mongoose.Types.ObjectId;
  const existingDept = await departments.findOne({ name: 'News & Current Affairs' });
  if (existingDept) {
    newsDeptId = existingDept._id as mongoose.Types.ObjectId;
  } else {
    const dRes = await departments.insertOne({
      name: 'News & Current Affairs',
      subsidiary: 'AIT',
      description: 'Television broadcast and investigative journalism division',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    newsDeptId = dRes.insertedId as mongoose.Types.ObjectId;
    console.log('✅  Department created — News & Current Affairs (AIT)');
  }

  // ─── HR user ────────────────────────────────────────────────────────────────
  const existingHR = await users.findOne({ email: 'hr@whippe.dev' });
  let hrUserId: mongoose.Types.ObjectId;
  if (existingHR) {
    console.log('⏭   HR user already exists — skipping');
    hrUserId = existingHR._id as mongoose.Types.ObjectId;
  } else {
    const hrRes = await users.insertOne({
      email: 'hr@whippe.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'HR',
      role: 'HR',
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      verificationExpiresAt: farFuture,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    hrUserId = hrRes.insertedId as mongoose.Types.ObjectId;
    console.log('✅  HR user created — hr@whippe.dev / Password123!');
  }

  // ─── Supervisor user & profile ──────────────────────────────────────────────
  const existingSupervisorUser = await users.findOne({ email: 'supervisor@whippe.dev' });
  let supervisorUserId: mongoose.Types.ObjectId;

  if (existingSupervisorUser) {
    console.log('⏭   Supervisor user already exists — skipping');
    supervisorUserId = existingSupervisorUser._id as mongoose.Types.ObjectId;
  } else {
    const sRes = await users.insertOne({
      email: 'supervisor@whippe.dev',
      passwordHash,
      firstName: 'Emeka',
      lastName: 'Eze',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      verificationExpiresAt: farFuture,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    supervisorUserId = sRes.insertedId as mongoose.Types.ObjectId;
    console.log('✅  Supervisor user created — supervisor@whippe.dev / Password123!');
  }

  const existingSupervisorProfile = await supervisors.findOne({ user: supervisorUserId });
  let supervisorRecordId: mongoose.Types.ObjectId;

  if (existingSupervisorProfile) {
    console.log('⏭   Supervisor profile already exists — skipping');
    supervisorRecordId = existingSupervisorProfile._id as mongoose.Types.ObjectId;
  } else {
    const spRes = await supervisors.insertOne({
      user: supervisorUserId,
      firstName: 'Emeka',
      lastName: 'Eze',
      phone: '08031234567',
      department: newsDeptId,
      isActive: true,
      createdBy: hrUserId,
      createdAt: now,
      updatedAt: now,
    });
    supervisorRecordId = spRes.insertedId as mongoose.Types.ObjectId;
    console.log('✅  Supervisor record created and assigned to News & Current Affairs');
  }

  // ─── Intern user ─────────────────────────────────────────────────────────────
  const existingInternUser = await users.findOne({ email: 'intern@whippe.dev' });
  let internUserId: mongoose.Types.ObjectId;

  if (existingInternUser) {
    console.log('⏭   Intern user already exists — skipping');
    internUserId = existingInternUser._id as mongoose.Types.ObjectId;
  } else {
    const result = await users.insertOne({
      email: 'intern@whippe.dev',
      passwordHash,
      firstName: 'Test',
      lastName: 'Intern',
      role: 'INTERN',
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      verificationExpiresAt: farFuture,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    internUserId = result.insertedId as mongoose.Types.ObjectId;
    console.log('✅  Intern user created — intern@whippe.dev / Password123!');
  }

  // ─── Intern record ────────────────────────────────────────────────────────────
  const existingIntern = await interns.findOne({ user: internUserId });
  if (existingIntern) {
    console.log('⏭   Intern record already exists — skipping');
  } else {
    await interns.insertOne({
      user: internUserId,
      firstName: 'Test',
      lastName: 'Intern',
      phone: '08098765432',
      institution: 'University of Lagos',
      course: 'Mass Communication',
      level: '300L',
      internshipType: 'INTERNSHIP',
      status: 'ACTIVE',
      department: newsDeptId,
      supervisor: supervisorRecordId,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-03-31'),
      createdBy: hrUserId,
      createdAt: now,
      updatedAt: now,
    });
    console.log('✅  Intern record created with assigned supervisor & department');
  }

  console.log('\n🎉  Seed complete!\n');
  console.log('  HR Admin:    hr@whippe.dev         / Password123!');
  console.log('  Supervisor:  supervisor@whippe.dev / Password123!');
  console.log('  Intern:      intern@whippe.dev     / Password123!\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
