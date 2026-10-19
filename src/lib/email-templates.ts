/**
 * email-templates.ts — Beautiful HTML + plain-text email templates.
 *
 * Design system:
 *  - Font: Plus Jakarta Sans via Google Fonts @import (falls back to system-ui)
 *  - Primary: #7C3AED (violet-600)
 *  - All layouts are table-based for Gmail/Outlook/Apple Mail compatibility
 *  - Each template has a unique accent colour for easy visual identification
 */

// ─── Shared constants ─────────────────────────────────────────────────────────

const BRAND      = 'Whippie';
const VIOLET     = '#7C3AED';
const VIOLET_DARK = '#5B21B6';
const BG         = '#F5F3FF';   // violet-50
const CARD       = '#FFFFFF';
const TEXT_DARK  = '#0F172A';   // slate-900
const TEXT_MID   = '#475569';   // slate-600
const TEXT_LIGHT = '#94A3B8';   // slate-400
const BORDER     = '#E2E8F0';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`;

// ─── Shared HTML wrapper ──────────────────────────────────────────────────────

function wrap({
  preheader,
  accentColor,
  iconEmoji,
  headingHtml,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  ctaColor,
  footerNote,
}: {
  preheader: string;
  accentColor: string;
  iconEmoji: string;
  headingHtml: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaColor?: string;
  footerNote: string;
}): string {
  const cta = ctaLabel && ctaUrl
    ? `
      <!-- CTA button -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;">
        <tr>
          <td align="center">
            <a href="${esc(ctaUrl)}"
               style="display:inline-block;background:${ctaColor ?? VIOLET};color:#ffffff;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:14px;letter-spacing:-0.01em;">
              ${esc(ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
      <!-- Fallback link -->
      <p style="margin:16px 0 0 0;text-align:center;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:12px;color:${TEXT_LIGHT};">
        Or copy this link into your browser:<br/>
        <a href="${esc(ctaUrl)}" style="color:${VIOLET};word-break:break-all;">${esc(ctaUrl)}</a>
      </p>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${BRAND}</title>
  <style>
    ${FONT_IMPORT}
    body { margin:0; padding:0; background:${BG}; }
    @media only screen and (max-width:600px) {
      .card { padding:28px 20px !important; }
      .logo-cell { padding-bottom:20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="max-width:560px;width:100%;background:${CARD};border-radius:20px;border:1px solid ${BORDER};overflow:hidden;">

          <!-- Accent bar -->
          <tr>
            <td style="background:${accentColor};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="card" style="padding:36px 40px 32px;">

              <!-- Logo + wordmark -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="logo-cell" style="padding-bottom:28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:${accentColor};border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;line-height:36px;">${iconEmoji}</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:17px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.02em;">${BRAND}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    ${headingHtml}
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    ${bodyHtml}
                    ${cta}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FAFAFA;border-top:1px solid ${BORDER};padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:12px;color:${TEXT_LIGHT};">
                ${esc(footerNote)}
              </p>
              <p style="margin:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:12px;color:${TEXT_LIGHT};">
                © ${new Date().getFullYear()} ${BRAND} · DAAR Communications
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyText(s: string) {
  return `<p style="margin:0 0 14px 0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:15px;line-height:1.65;color:${TEXT_MID};">${s}</p>`;
}

function heading(s: string) {
  return `<h1 style="margin:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.025em;line-height:1.2;">${s}</h1>`;
}

function highlight(s: string) {
  return `<span style="color:${VIOLET};font-weight:700;">${s}</span>`;
}

function infoBox(lines: string[], color: string) {
  const rows = lines.map(l =>
    `<tr>
      <td style="padding:6px 0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:14px;color:${TEXT_MID};line-height:1.5;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};vertical-align:middle;margin-right:10px;"></span>${l}
      </td>
    </tr>`,
  ).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:20px 0 0 0;background:#F8F7FF;border:1px solid #EDE9FE;border-radius:12px;padding:0;">
      <tr><td style="padding:16px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ─── 1. Email verification ────────────────────────────────────────────────────

export interface VerificationEmailInput {
  firstName: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function renderVerificationEmail(input: VerificationEmailInput): RenderedEmail {
  const subject = `Verify your ${BRAND} email address`;

  const html = wrap({
    preheader: 'One click to confirm your email and get started.',
    accentColor: VIOLET,
    iconEmoji: '✉️',
    headingHtml: heading(`Hi ${esc(input.firstName)}, confirm your email`),
    bodyHtml: `
      ${bodyText(`You're almost in. Click the button below to verify your email address and activate your ${highlight(BRAND)} account.`)}
      ${bodyText(`Once verified, your account will be reviewed by HR before you can sign in.`)}
      ${infoBox([
        `This link expires in <strong>${input.expiresInHours} hour${input.expiresInHours === 1 ? '' : 's'}</strong>.`,
        'The link can only be used once.',
        "If you didn't sign up, you can safely ignore this email.",
      ], VIOLET)}
    `,
    ctaLabel: 'Verify my email',
    ctaUrl: input.verifyUrl,
    ctaColor: VIOLET,
    footerNote: `You received this because an account was created at ${BRAND} with this email address.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Please verify your email address to activate your ${BRAND} account.`,
    `Once verified, HR will review your account before you can sign in.`,
    '',
    `Verify your email (expires in ${input.expiresInHours} hours):`,
    input.verifyUrl,
    '',
    `If you didn't create a ${BRAND} account, ignore this email.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── 2. Password reset ────────────────────────────────────────────────────────

export interface PasswordResetEmailInput {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const subject = `Reset your ${BRAND} password`;
  const AMBER = '#D97706';

  const html = wrap({
    preheader: 'A password reset was requested for your account.',
    accentColor: AMBER,
    iconEmoji: '🔑',
    headingHtml: heading(`Reset your password`),
    bodyHtml: `
      ${bodyText(`Hi ${esc(input.firstName)}, we received a request to reset the password on your ${highlight(BRAND)} account.`)}
      ${bodyText(`Click the button below to choose a new password.`)}
      ${infoBox([
        `This link expires in <strong>${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}</strong>.`,
        'The link can only be used once.',
        "If you didn't request this, your password hasn't been changed.",
      ], AMBER)}
    `,
    ctaLabel: 'Reset my password',
    ctaUrl: input.resetUrl,
    ctaColor: AMBER,
    footerNote: `You received this because a password reset was requested for your ${BRAND} account.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `We received a request to reset the password on your ${BRAND} account.`,
    '',
    `Reset your password (expires in ${input.expiresInMinutes} minutes):`,
    input.resetUrl,
    '',
    `If you didn't request a password reset, ignore this email — your password hasn't changed.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── 3. Welcome (HR approved) ─────────────────────────────────────────────────

export interface WelcomeEmailInput {
  firstName: string;
  loginUrl: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const subject = `Welcome to ${BRAND} — you're approved! 🎉`;
  const EMERALD = '#059669';

  const html = wrap({
    preheader: `Great news — your account has been approved by HR.`,
    accentColor: EMERALD,
    iconEmoji: '🎉',
    headingHtml: heading(`You're in, ${esc(input.firstName)}!`),
    bodyHtml: `
      ${bodyText(`HR has approved your ${highlight(BRAND)} account. You can now sign in and start your internship journey.`)}
      ${infoBox([
        'Check in daily using the attendance feature.',
        'View and complete your assigned tasks.',
        'Submit daily and weekly reports to your supervisor.',
      ], EMERALD)}
    `,
    ctaLabel: 'Sign in to Whippie',
    ctaUrl: input.loginUrl,
    ctaColor: EMERALD,
    footerNote: `You received this because your ${BRAND} account was approved by HR.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Great news — HR has approved your ${BRAND} account!`,
    `You can now sign in and start using the platform.`,
    '',
    'Sign in:',
    input.loginUrl,
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── 4. Account rejected ──────────────────────────────────────────────────────

export interface RejectionEmailInput {
  firstName: string;
  rejectionReason?: string;
  supportUrl: string;
}

export function renderRejectionEmail(input: RejectionEmailInput): RenderedEmail {
  const subject = `Update on your ${BRAND} account`;
  const ROSE = '#E11D48';

  const reasonRow = input.rejectionReason
    ? infoBox([`Reason: <strong>${esc(input.rejectionReason)}</strong>`], ROSE)
    : '';

  const html = wrap({
    preheader: `An update regarding your ${BRAND} account application.`,
    accentColor: ROSE,
    iconEmoji: '📋',
    headingHtml: heading(`Account update`),
    bodyHtml: `
      ${bodyText(`Hi ${esc(input.firstName)}, thank you for your interest in ${highlight(BRAND)}.`)}
      ${bodyText(`Unfortunately, your account request was not approved at this time.`)}
      ${reasonRow}
      ${bodyText(`If you believe this is a mistake or would like more information, please reach out to your HR administrator.`)}
    `,
    ctaLabel: 'Contact HR',
    ctaUrl: input.supportUrl,
    ctaColor: ROSE,
    footerNote: `You received this because an account was created at ${BRAND} with this email address.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your interest in ${BRAND}.`,
    `Unfortunately, your account request was not approved at this time.`,
    input.rejectionReason ? `Reason: ${input.rejectionReason}` : '',
    '',
    `If you believe this is a mistake, contact your HR administrator.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND}`,
  ].filter(l => l !== undefined).join('\n');

  return { subject, html, text };
}
