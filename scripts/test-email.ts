/**
 * test-email.ts — quick sanity check for the Mailtrap email setup.
 *
 * Sends one of each template type so you can verify they all render and
 * deliver correctly before going live.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts
 *
 * Make sure MAILTRAP_TOKEN is set in .env before running.
 * Check results at: https://mailtrap.io/sending/email_logs
 */

import 'dotenv/config';
import { sendEmail } from '../src/lib/email';
import {
  renderVerificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  renderRejectionEmail,
} from '../src/lib/email-templates';

// ── Change this to your own email to receive the test messages ───────────────
const TEST_RECIPIENT = 'faveejiofor2009@gmail.com';

// ── Fake data used to populate the templates ─────────────────────────────────
const FAKE_FIRST_NAME = 'Favour';
const FAKE_VERIFY_URL = 'http://localhost:3000/auth/verify-email?token=test-token-abc123';
const FAKE_RESET_URL  = 'http://localhost:3000/auth/reset-password?token=test-token-xyz789';
const FAKE_LOGIN_URL  = 'http://localhost:3000/login';
const FAKE_SUPPORT_URL = 'http://localhost:3000/login';

async function run() {
  console.log(`\n📬 Sending test emails to: ${TEST_RECIPIENT}\n`);

  const tests: Array<{ name: string; email: ReturnType<typeof renderVerificationEmail> }> = [
    {
      name: 'Email verification',
      email: renderVerificationEmail({
        firstName: FAKE_FIRST_NAME,
        verifyUrl: FAKE_VERIFY_URL,
        expiresInHours: 24,
      }),
    },
    {
      name: 'Password reset',
      email: renderPasswordResetEmail({
        firstName: FAKE_FIRST_NAME,
        resetUrl: FAKE_RESET_URL,
        expiresInMinutes: 60,
      }),
    },
    {
      name: 'Welcome (HR approved)',
      email: renderWelcomeEmail({
        firstName: FAKE_FIRST_NAME,
        loginUrl: FAKE_LOGIN_URL,
      }),
    },
    {
      name: 'Account rejected',
      email: renderRejectionEmail({
        firstName: FAKE_FIRST_NAME,
        rejectionReason: 'Internship slots are currently full.',
        supportUrl: FAKE_SUPPORT_URL,
      }),
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`  Sending "${test.name}"... `);
    const ok = await sendEmail({
      to: TEST_RECIPIENT,
      subject: `[TEST] ${test.email.subject}`,
      html: test.email.html,
      text: test.email.text,
    });

    if (ok) {
      console.log('✅');
      passed++;
    } else {
      console.log('❌  (check console above for error details)');
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  ${passed} passed   ${failed} failed`);

  if (passed > 0) {
    console.log('\n👉 Check your sent logs at:');
    console.log('   https://mailtrap.io/sending/email_logs\n');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
