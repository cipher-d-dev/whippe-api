import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.model';
import { Role, AccountStatus, AuthMethod } from '../modules/auth/auth.types';

export async function ensureDefaultHR(): Promise<void> {
  const hrEmail = process.env['INITIAL_HR_EMAIL'] || 'hr@whippie.app';
  const hrPassword = process.env['INITIAL_HR_PASSWORD'] || 'Admin@Whippie2026!';
  const hrFirstName = process.env['INITIAL_HR_FIRSTNAME'] || 'HR';
  const hrLastName = process.env['INITIAL_HR_LASTNAME'] || 'Administrator';

  const existingHR = await User.findOne({
    $or: [{ role: Role.HR }, { email: hrEmail.toLowerCase() }],
  });

  if (existingHR) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(hrPassword, salt);

  const verificationExpiresAt = new Date();
  verificationExpiresAt.setDate(verificationExpiresAt.getDate() + 3650); // 10 years

  await User.create({
    email: hrEmail.toLowerCase(),
    passwordHash,
    firstName: hrFirstName,
    lastName: hrLastName,
    role: Role.HR,
    status: AccountStatus.ACTIVE,
    authMethod: AuthMethod.PASSWORD,
    emailVerifiedAt: new Date(),
    verificationExpiresAt,
  });

  console.log(`\n======================================================`);
  console.log(`🎉  INITIAL HR ACCOUNT AUTOMATICALLY CREATED:`);
  console.log(`    Email:    ${hrEmail}`);
  console.log(`    Password: ${hrPassword}`);
  console.log(`======================================================\n`);
}
