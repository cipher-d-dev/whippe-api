/**
 * One-time update (25 Nov 2026): supervisors kept trying to "sign up" instead
 * of signing in with the account HR made for them.
 *
 * 1. Changes two supervisors' emails to the addresses HR gave:
 *    Joshua Oyeleye and Adebayo Adediwura.
 * 2. Gives every active supervisor a new temporary password and emails them a
 *    plain "Please accept your invitation to Whippie" message: sign in, don't
 *    sign up, with the link, their email, the password and their departments.
 *
 * The old password stops working, so everyone gets the email. Google-only
 * accounts keep Google sign-in and are skipped. Each person is logged.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Supervisor } from '../modules/supervisors/supervisor.model';
import { User } from '../modules/users/user.model';
import { AccountStatus, AuthMethod } from '../modules/auth/auth.types';
import { sendEmail } from '../lib/email';
import { renderSupervisorReinviteEmail } from '../lib/email-templates';
import { staffPortalUrl } from '../lib/urls';

export const name = '2026-11-supervisor-reinvite';

const BCRYPT_ROUNDS = 12;

/** Old account email → new email HR provided. */
export const EMAIL_CHANGES: Record<string, string> = {
  'tallex8@gmail.com': 'tallex7@gmail.com', // Joshua Oyeleye
  'adediwuraadebayo1@yahoo.com': 'adebayoadediwura83@gmail.com', // Adebayo Adediwura
};

/** Pause between emails so the mail provider doesn't throttle us. */
export let SEND_GAP_MS = 1500;
export function setSendGap(ms: number) { SEND_GAP_MS = ms; }

export async function up(log: (line: string) => void): Promise<void> {
  for (const [from, to] of Object.entries(EMAIL_CHANGES)) {
    const taken = await User.findOne({ email: to });
    const user = await User.findOne({ email: from });
    if (!user) { log(taken ? `${to} already in place` : `Email change skipped: no account for ${from}`); continue; }
    if (taken) { log(`Email change skipped: ${to} already belongs to another account`); continue; }
    user.email = to;
    await user.save();
    log(`Changed ${from} → ${to}`);
  }

  const loginUrl = `${staffPortalUrl()}/login`;
  const supervisors = await Supervisor.find({ isActive: true }).populate('departments', 'name');
  let sent = 0;
  let failed = 0;

  for (const sup of supervisors) {
    const user = await User.findById(sup.user);
    if (!user?.email) { log(`Skipped ${sup.firstName} ${sup.lastName}: no login account`); continue; }
    if (user.authMethod === AuthMethod.GOOGLE) { log(`Skipped ${user.email}: signs in with Google`); continue; }

    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    user.passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    if (user.status !== AccountStatus.ACTIVE) user.status = AccountStatus.ACTIVE;
    await user.save();

    const departments = ((sup.departments ?? []) as unknown as { name?: string }[])
      .map((d) => d?.name)
      .filter((n): n is string => !!n);
    const email = renderSupervisorReinviteEmail({
      firstName: sup.firstName,
      email: user.email,
      temporaryPassword,
      loginUrl,
      departments,
    });
    const ok = await sendEmail({ to: user.email, subject: email.subject, html: email.html, text: email.text });
    if (ok) { sent++; log(`Invited ${user.email}`); } else { failed++; log(`Email FAILED for ${user.email}; they can use Forgot password on the sign-in page`); }
    if (SEND_GAP_MS) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
  }

  log(`Done: ${sent} invited, ${failed} failed, ${supervisors.length} active supervisors`);
}
