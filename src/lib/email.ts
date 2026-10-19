/**
 * email.ts — Mailtrap-backed email sender.
 *
 * When MAILTRAP_TOKEN is set, emails are dispatched via the Mailtrap
 * Email Sending API (nodemailer + MailtrapTransport).
 * When it is absent (local dev without a token), the email payload is logged
 * to the console instead — no mail is sent but the flow is fully exercised.
 *
 * Check sent logs at: https://mailtrap.io/sending/email_logs
 *
 * Import sendEmail() wherever you need to send transactional mail.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ─── Transport (lazy — only created when token is present) ───────────────────

let _transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (_transport) return _transport;
  if (env.MAILTRAP_TOKEN) {
    _transport = nodemailer.createTransport(
      MailtrapTransport({ token: env.MAILTRAP_TOKEN }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any as Transporter;
  }
  return _transport;
}

// ─── Sender identity ──────────────────────────────────────────────────────────
// Parsed from EMAIL_FROM: "Whippie <no-reply@whippie.app>"
// Falls back to a safe default if the env var is missing.

function parseSender(from: string): { name: string; address: string } {
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), address: match[2].trim() };
  }
  // Plain address with no display name
  return { name: 'Whippie', address: from.trim() };
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

/**
 * Send a transactional email.
 *
 * Never throws on delivery failure — errors are logged and swallowed so a
 * broken email send never crashes a signup or password-reset flow.
 *
 * Returns true if sent (or stubbed), false if an error occurred.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transport = getTransport();

  // ── Stub mode (no token) ──────────────────────────────────────────────────
  if (!transport) {
    console.log('\n📧 [EMAIL STUB — no MAILTRAP_TOKEN set]');
    console.log('  To:      ', input.to);
    console.log('  Subject: ', input.subject);
    console.log('  Body:\n');
    console.log(input.text);
    console.log('─────────────────────────────────────────────────────────');
    return true;
  }

  // ── Real send via Mailtrap ────────────────────────────────────────────────
  try {
    const sender = parseSender(env.EMAIL_FROM ?? 'Whippie <no-reply@whippie.app>');

    await transport.sendMail({
      from: sender,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return true;
  } catch (err) {
    console.error('[email] Mailtrap delivery error:', err);
    return false;
  }
}
