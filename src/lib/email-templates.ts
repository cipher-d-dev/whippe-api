/**
 * Email templates — plain-text + HTML strings for transactional emails.
 *
 * HTML uses table-based layout and inline styles for max compatibility with
 * Gmail / Outlook / Apple Mail. The visual identity mirrors the Whippie web
 * app: violet primary (#7C3AED), neutral surface, Plus Jakarta Sans fallback.
 *
 * Templates return both `text` (for accessibility / spam filters) and `html`.
 */

// ─── Brand ────────────────────────────────────────────────────────────────────

const BRAND = 'Whippie';
const PRIMARY = '#7C3AED';      // violet-600 — matches whippie-intern/whippie-web tokens
const PRIMARY_HOVER = '#6D28D9'; // violet-700
const SURFACE = '#FFFFFF';
const MUTED = '#64748B';        // slate-500
const TEXT = '#0F172A';         // slate-900
const BORDER = '#E2E8F0';       // slate-200
const SUBTLE_BG = '#F8FAFC';    // slate-50

// ─── Base layout ──────────────────────────────────────────────────────────────

interface BaseEmailInput {
  preheader: string;            // shown in inbox preview; hidden in body
  greetingName: string;
  bodyHtml: string;             // inner HTML for the body block
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote: string;
}

function baseHtml(input: BaseEmailInput): string {
  const ctaHtml = input.ctaLabel && input.ctaUrl
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px 0;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(input.ctaUrl)}"
               style="display:inline-block;background:${PRIMARY};color:#FFFFFF;font-family:Plus Jakarta Sans,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:12px;">
              ${escapeHtml(input.ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 0 0;font-family:Plus Jakarta Sans,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};text-align:center;">
        Or paste this link into your browser:<br />
        <a href="${escapeHtml(input.ctaUrl)}" style="color:${PRIMARY};word-break:break-all;text-decoration:none;">${escapeHtml(input.ctaUrl)}</a>
      </p>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(BRAND)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width: 560px) {
      .wrap { width:100% !important; padding:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${SUBTLE_BG};">
  <!-- hidden preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(input.preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SUBTLE_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="wrap" width="520" cellpadding="0" cellspacing="0" style="background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;padding:32px;width:520px;max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <h1 style="margin:0;font-family:Plus Jakarta Sans,Segoe UI,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:${TEXT};letter-spacing:-0.02em;">
                ${BRAND}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0;font-family:Plus Jakarta Sans,Segoe UI,Helvetica,Arial,sans-serif;color:${TEXT};font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px 0;">Hi ${escapeHtml(input.greetingName)},</p>
              ${input.bodyHtml}
              ${ctaHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;border-top:1px solid ${BORDER};font-family:Plus Jakarta Sans,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};text-align:center;">
              <p style="margin:0 0 8px 0;">${escapeHtml(input.footerNote)}</p>
              <p style="margin:0;">© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Verification email ──────────────────────────────────────────────────────

export interface VerificationEmailInput {
  firstName: string;
  verifyUrl: string;     // full URL incl. token, e.g. https://app/verify-email?token=...
  expiresInHours: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderVerificationEmail(
  input: VerificationEmailInput,
): RenderedEmail {
  const subject = `Verify your email for ${BRAND}`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Please confirm your email address to activate your ${BRAND} account. Once verified, your account will be reviewed by HR before you can sign in.
    </p>
    <p style="margin:0 0 8px 0;">
      This link expires in <strong>${input.expiresInHours} hour${input.expiresInHours === 1 ? '' : 's'}</strong>.
    </p>
  `;

  const html = baseHtml({
    preheader: 'Confirm your email address to continue.',
    greetingName: input.firstName,
    bodyHtml,
    ctaLabel: 'Verify my email',
    ctaUrl: input.verifyUrl,
    footerNote:
      "If you didn't create a Whippie account, you can safely ignore this email — no action is needed.",
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Please confirm your email address to activate your ${BRAND} account.`,
    `Once verified, your account will be reviewed by HR before you can sign in.`,
    '',
    `Verify your email (link expires in ${input.expiresInHours} hour${input.expiresInHours === 1 ? '' : 's'}):`,
    input.verifyUrl,
    '',
    "If you didn't create a Whippie account, you can safely ignore this email.",
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── Password reset email ────────────────────────────────────────────────────

export interface PasswordResetEmailInput {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(
  input: PasswordResetEmailInput,
): RenderedEmail {
  const subject = `Reset your ${BRAND} password`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      We received a request to reset the password on your ${BRAND} account. Click the button below to choose a new password.
    </p>
    <p style="margin:0 0 8px 0;">
      This link expires in <strong>${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}</strong>.
    </p>
  `;

  const html = baseHtml({
    preheader: 'Choose a new password for your account.',
    greetingName: input.firstName,
    bodyHtml,
    ctaLabel: 'Reset my password',
    ctaUrl: input.resetUrl,
    footerNote:
      "If you didn't request a password reset, ignore this email — your password hasn't been changed.",
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `We received a request to reset the password on your ${BRAND} account.`,
    '',
    `Reset your password (link expires in ${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}):`,
    input.resetUrl,
    '',
    "If you didn't request a password reset, ignore this email — your password hasn't been changed.",
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── Welcome email (HR approval notification) ───────────────────────────────

export interface WelcomeEmailInput {
  firstName: string;
  loginUrl: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const subject = `Your ${BRAND} account is approved`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Great news — HR has approved your ${BRAND} account. You can now sign in and start using the platform.
    </p>
    <p style="margin:0 0 8px 0;">
      Welcome aboard! 🎉
    </p>
  `;

  const html = baseHtml({
    preheader: 'Your account has been approved by HR.',
    greetingName: input.firstName,
    bodyHtml,
    ctaLabel: 'Sign in',
    ctaUrl: input.loginUrl,
    footerNote:
      "If you didn't expect this email, contact your HR administrator.",
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Great news — HR has approved your ${BRAND} account.`,
    'You can now sign in and start using the platform.',
    '',
    'Sign in:',
    input.loginUrl,
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── Account rejected email ──────────────────────────────────────────────────

export interface RejectionEmailInput {
  firstName: string;
  rejectionReason?: string;
  supportUrl: string;
}

export function renderRejectionEmail(
  input: RejectionEmailInput,
): RenderedEmail {
  const subject = `Update on your ${BRAND} account`;
  const reasonHtml = input.rejectionReason
    ? `<p style="margin:0 0 8px 0;"><strong>Reason:</strong> ${escapeHtml(input.rejectionReason)}</p>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Thank you for your interest in ${BRAND}. Unfortunately, your account request was not approved at this time.
    </p>
    ${reasonHtml}
    <p style="margin:0 0 8px 0;">
      If you believe this is a mistake, please reach out to your HR administrator.
    </p>
  `;

  const html = baseHtml({
    preheader: 'Your account request was not approved.',
    greetingName: input.firstName,
    bodyHtml,
    ctaLabel: 'Contact support',
    ctaUrl: input.supportUrl,
    footerNote:
      'You received this email because an account was created with this address.',
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your interest in ${BRAND}.`,
    'Unfortunately, your account request was not approved at this time.',
    input.rejectionReason ? `Reason: ${input.rejectionReason}` : '',
    '',
    'If you believe this is a mistake, please reach out to your HR administrator.',
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}
