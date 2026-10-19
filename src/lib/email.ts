/**
 * email.ts — Mailtrap Email Sending API via nodemailer + MailtrapTransport.
 *
 * Mirrors the verified working pattern from scripts/test-email.ts exactly.
 * When MAILTRAP_TOKEN is absent (local dev), emails are logged to console.
 *
 * Check sent logs at: https://mailtrap.io/sending/email_logs
 */

import Nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: string;
}

// ─── Transport (lazy singleton) ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _transport: any = null;

function getTransport() {
  if (_transport) return _transport;
  if (env.MAILTRAP_TOKEN) {
    _transport = Nodemailer.createTransport(
      MailtrapTransport({ token: env.MAILTRAP_TOKEN }),
    );
  }
  return _transport;
}

// ─── Sender ───────────────────────────────────────────────────────────────────

function getSender(): { address: string; name: string } {
  const from = env.EMAIL_FROM ?? 'Whippie <hello@isbmpa.com>';
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  return { name: 'Whippie', address: from.trim() };
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

/**
 * Send a transactional email.
 * Never throws — errors are logged and swallowed so delivery failure
 * never crashes a signup or password-reset request.
 * Returns true if sent (or stubbed), false on error.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transport = getTransport();

  // ── Stub mode ─────────────────────────────────────────────────────────────
  if (!transport) {
    console.log('\n📧 [EMAIL STUB — no MAILTRAP_TOKEN set]');
    console.log('  To:      ', input.to);
    console.log('  Subject: ', input.subject);
    console.log('  Body:\n');
    console.log(input.text);
    console.log('─────────────────────────────────────────────────────────');
    return true;
  }

  // ── Real send ─────────────────────────────────────────────────────────────
  try {
    await transport.sendMail({
      from: getSender(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.category ? { category: input.category } : {}),
    });
    return true;
  } catch (err) {
    console.error('[email] Mailtrap delivery error:', err);
    return false;
  }
}
