/**
 * test-email.ts — sanity check for the Mailtrap Email Sending API.
 *
 * Sends a simple test email first to confirm the token + domain work,
 * then sends all 4 Whippie templates.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts
 *
 * Required in .env:
 *   MAILTRAP_TOKEN=your_api_token_here
 *
 * Check results at: https://mailtrap.io/sending/email_logs
 */

import 'dotenv/config';
import Nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import {
  renderVerificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  renderRejectionEmail,
} from '../src/lib/email-templates';

const TOKEN = process.env['MAILTRAP_TOKEN'];

if (!TOKEN) {
  console.error('❌  MAILTRAP_TOKEN is not set in .env');
  process.exit(1);
}

const transport = Nodemailer.createTransport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MailtrapTransport({ token: TOKEN }) as any,
);

const sender = {
  address: 'hello@isbmpa.com',
  name: 'Whippie',
};

const recipients = ['faveejiofor2009@gmail.com'];

const FAKE = {
  firstName:  'Favour',
  verifyUrl:  'http://localhost:3000/auth/verify-email?token=test-abc123',
  resetUrl:   'http://localhost:3000/auth/reset-password?token=test-xyz789',
  loginUrl:   'http://localhost:3000/login',
  supportUrl: 'http://localhost:3000/login',
};

async function run() {
  console.log('\n📬 Sending test emails via Mailtrap...\n');

  // ── 1. Simple smoke test (mirrors the sample exactly) ────────────────────
  console.log('  [1/5] Simple smoke test...');
  try {
    const info = await transport.sendMail({
      from: sender,
      to: recipients,
      subject: 'You are awesome!',
      text: 'Congrats for sending test email with Mailtrap!',
      category: 'Integration Test',
    });
    console.log('  ✅  messageId:', (info as any).messageId ?? JSON.stringify(info));
  } catch (err) {
    console.error('  ❌  smoke test failed:', err);
    process.exit(1);
  }

  // ── 2. All 4 Whippie templates ────────────────────────────────────────────
  const templates = [
    {
      label: 'Email verification',
      ...renderVerificationEmail({ firstName: FAKE.firstName, verifyUrl: FAKE.verifyUrl, expiresInHours: 24 }),
    },
    {
      label: 'Password reset',
      ...renderPasswordResetEmail({ firstName: FAKE.firstName, resetUrl: FAKE.resetUrl, expiresInMinutes: 60 }),
    },
    {
      label: 'Welcome (HR approved)',
      ...renderWelcomeEmail({ firstName: FAKE.firstName, loginUrl: FAKE.loginUrl }),
    },
    {
      label: 'Account rejected',
      ...renderRejectionEmail({ firstName: FAKE.firstName, rejectionReason: 'Slots currently full.', supportUrl: FAKE.supportUrl }),
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const [i, t] of templates.entries()) {
    process.stdout.write(`  [${i + 2}/5] "${t.label}"... `);
    try {
      const info = await transport.sendMail({
        from: sender,
        to: recipients,
        subject: `[TEST] ${t.subject}`,
        html: t.html,
        text: t.text,
        category: 'Whippie Test',
      });
      console.log(`✅  messageId: ${(info as any).messageId ?? JSON.stringify(info)}`);
      passed++;
    } catch (err) {
      console.log('❌');
      console.error('   ', err);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  ${passed + 1} passed   ${failed} failed`);
  console.log('\n👉 Check sent logs at:');
  console.log('   https://mailtrap.io/sending/email_logs\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
