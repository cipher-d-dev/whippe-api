/**
 * email.ts — Resend-backed email sender.
 *
 * When RESEND_API_KEY is set, emails are dispatched via Resend.
 * When it is absent (local dev without a key), the email payload is logged
 * to the console instead — no mail is sent, but the flow is fully exercised.
 *
 * Import sendEmail() wherever you need to send transactional mail.
 */

import { Resend } from 'resend';
import { env } from '../config/env';

// ─── Client (lazy — only initialised when key is present) ────────────────────

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  if (env.RESEND_API_KEY) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

/**
 * Send a transactional email.
 *
 * The function never throws on email failure — a delivery error must never
 * crash a signup or password-reset request. Errors are logged and swallowed.
 *
 * Returns true if sent (or stubbed), false if an error occurred.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const resend = getResend();

  // ── Stub mode (no API key) ────────────────────────────────────────────────
  if (!resend) {
    console.log('\n📧 [EMAIL STUB — no RESEND_API_KEY set]');
    console.log('  To:      ', input.to);
    console.log('  Subject: ', input.subject);
    console.log('  Body:\n');
    console.log(input.text);
    console.log('─────────────────────────────────────────────────────────');
    return true;
  }

  // ── Real send via Resend ──────────────────────────────────────────────────
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM ?? 'Whippie <no-reply@whippie.app>',
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      console.error('[email] Resend delivery error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Unexpected error sending email:', err);
    return false;
  }
}
