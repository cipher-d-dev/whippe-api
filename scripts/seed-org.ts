/**
 * seed-org.ts
 *
 * Populates official DAAR Communications departments and registers
 * supervisors who have confirmed email addresses.
 *
 * Features:
 * - Completely idempotent (safe to run multiple times without duplicating data)
 * - Has an optional --send-emails flag to dispatch welcome emails with temporary passwords
 *   Default: dry-run / no emails sent unless explicit flag is passed or confirmed.
 *
 * Run with:
 *   npx tsx scripts/seed-org.ts
 *   npx tsx scripts/seed-org.ts --send-emails
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../src/lib/email';
import { renderSupervisorInviteEmail } from '../src/lib/email-templates';

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

const shouldSendEmails = process.argv.includes('--send-emails');

interface DeptDef {
  name: string;
  subsidiary?: string;
  description?: string;
}

const DEPARTMENTS: DeptDef[] = [
  { name: 'RAYPOWER PROGRAMMES & PRODUCTION', subsidiary: 'Raypower' },
  { name: 'FAAJI FM', subsidiary: 'Faaji' },
  { name: 'NEWS DEPARTMENT', subsidiary: 'AIT' },
  { name: 'ENGINEERING SERVICES', subsidiary: 'DAAR Corporate' },
  { name: 'ICT UNIT, ENGINEERING SERVICES', subsidiary: 'DAAR Corporate' },
  { name: 'RAYPOWER ONLINE UNIT', subsidiary: 'Raypower' },
  { name: 'MARKETING & SALES DEPARTMENT/ADVERT TRAFFIC UNIT', subsidiary: 'DAAR Corporate' },
  { name: 'MARKETING & SALES DEPARTMENT', subsidiary: 'DAAR Corporate' },
  { name: 'MARKETING & SALES DEPARTMENT/MONITORING UNIT', subsidiary: 'DAAR Corporate' },
  { name: 'FINANCE & ACCOUNTS', subsidiary: 'DAAR Corporate' },
  { name: 'INTERNAL AUDIT', subsidiary: 'DAAR Corporate' },
  { name: 'DVSL/PRODUCTION', subsidiary: 'AIT' },
];

interface SupervisorDef {
  firstName: string;
  lastName: string;
  email: string;
  departmentName: string;
}

// Supervisors with provided email addresses
const CONFIRMED_SUPERVISORS: SupervisorDef[] = [
  {
    firstName: 'Kenneth',
    lastName: 'Atuma',
    email: 'atumauzoma@gmail.com',
    departmentName: 'RAYPOWER PROGRAMMES & PRODUCTION',
  },
  {
    firstName: 'Olaniyi',
    lastName: 'Olaosebikan',
    email: 'loab1014u2meet77@gmail.com',
    departmentName: 'FAAJI FM',
  },
  {
    firstName: 'Nkoli',
    lastName: 'Ohmoudu',
    email: 'nkoliemenari2000@yahoo.co.uk',
    departmentName: 'NEWS DEPARTMENT',
  },
  {
    firstName: 'Abiola',
    lastName: 'Beckley',
    email: 'beckleyabiola@gmail.com',
    departmentName: 'NEWS DEPARTMENT',
  },
  {
    firstName: 'Obinna',
    lastName: 'Umeh',
    email: 'Obinnaume341@gmail.com',
    departmentName: 'NEWS DEPARTMENT',
  },
  {
    firstName: 'Gregory',
    lastName: 'Ugbodaga',
    email: 'greg_ugbodaga2@yahoo.com',
    departmentName: 'ENGINEERING SERVICES',
  },
  {
    firstName: 'Joshua',
    lastName: 'Oyeleye',
    email: 'Tallex8@gmail.com',
    departmentName: 'ICT UNIT, ENGINEERING SERVICES',
  },
  {
    firstName: 'Faith',
    lastName: 'Ebije',
    email: 'Febije@yahoo.com',
    departmentName: 'MARKETING & SALES DEPARTMENT',
  },
  {
    firstName: 'Johnson',
    lastName: 'Ogunlade',
    email: 'ogunlade.johnson@yahoo.com',
    departmentName: 'FINANCE & ACCOUNTS',
  },
  {
    firstName: 'David',
    lastName: 'Olamide',
    email: 'dolamide99@yahoo.com',
    departmentName: 'FINANCE & ACCOUNTS',
  },
];

async function run() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');

  const usersCol = db.collection('users');
  const deptsCol = db.collection('departments');
  const supsCol = db.collection('supervisors');

  const hrUser = await usersCol.findOne({ role: 'HR' });
  const hrId = hrUser ? hrUser._id : new mongoose.Types.ObjectId();

  const now = new Date();
  const farFuture = new Date('2099-01-01');

  // 1. Seed Departments
  console.log('--- SEEDING DEPARTMENTS ---');
  const deptMap = new Map<string, mongoose.Types.ObjectId>();

  for (const dept of DEPARTMENTS) {
    const existing = await deptsCol.findOne({
      name: { $regex: new RegExp(`^${dept.name.trim()}$`, 'i') },
    });

    if (existing) {
      deptMap.set(dept.name, existing._id as mongoose.Types.ObjectId);
      console.log(`  ✓ Exists: ${dept.name}`);
    } else {
      const res = await deptsCol.insertOne({
        name: dept.name,
        subsidiary: dept.subsidiary,
        isActive: true,
        createdBy: hrId,
        createdAt: now,
        updatedAt: now,
      });
      deptMap.set(dept.name, res.insertedId as mongoose.Types.ObjectId);
      console.log(`  + Created: ${dept.name}`);
    }
  }

  // 2. Seed Supervisors
  console.log('\n--- SEEDING SUPERVISORS ---');
  console.log(`Mode: ${shouldSendEmails ? '🚀 SENDING EMAILS ENABLED' : '🔒 DRY-RUN (Emails will NOT be dispatched without --send-emails)'}\n`);

  for (const sup of CONFIRMED_SUPERVISORS) {
    const normalizedEmail = sup.email.trim().toLowerCase();
    const existingUser = await usersCol.findOne({ email: normalizedEmail });

    let userId: mongoose.Types.ObjectId;
    let tempPassword = '';

    if (existingUser) {
      userId = existingUser._id as mongoose.Types.ObjectId;
      console.log(`  ✓ User account already exists: ${sup.firstName} ${sup.lastName} (${normalizedEmail})`);
    } else {
      tempPassword = `DAAR@${crypto.randomInt(100000, 999999)}`;
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      const userRes = await usersCol.insertOne({
        email: normalizedEmail,
        passwordHash,
        firstName: sup.firstName,
        lastName: sup.lastName,
        role: 'SUPERVISOR',
        status: 'ACTIVE',
        authMethod: 'PASSWORD',
        verificationExpiresAt: farFuture,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      userId = userRes.insertedId as mongoose.Types.ObjectId;
      console.log(`  + Created user: ${sup.firstName} ${sup.lastName} (${normalizedEmail})`);
    }

    const deptId = deptMap.get(sup.departmentName);
    const existingSup = await supsCol.findOne({ user: userId });

    if (existingSup) {
      console.log(`  ✓ Supervisor profile already linked: ${sup.firstName} ${sup.lastName}`);
    } else {
      await supsCol.insertOne({
        user: userId,
        firstName: sup.firstName,
        lastName: sup.lastName,
        department: deptId,
        isActive: true,
        createdBy: hrId,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  + Created supervisor profile linked to ${sup.departmentName}`);
    }

    if (shouldSendEmails && tempPassword) {
      console.log(`  📧 Dispatching invitation email to ${normalizedEmail}...`);
      try {
        const rendered = renderSupervisorInviteEmail({
          firstName: sup.firstName,
          email: normalizedEmail,
          temporaryPassword: tempPassword,
          loginUrl: `${process.env['FRONTEND_URL'] || 'https://whippie.app'}/login`,
          departmentName: sup.departmentName,
        });

        await sendEmail({
          to: normalizedEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        console.log(`  ✓ Invitation email successfully sent to ${normalizedEmail}`);
      } catch (err) {
        console.error(`  ❌ Failed to send email to ${normalizedEmail}:`, err);
      }
    }
  }

  console.log('\n🎉 Finished seeding departments and supervisors.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Error during script execution:', err);
  process.exit(1);
});
