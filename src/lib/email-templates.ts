/**
 * email-templates.ts — Modern, polished HTML & plain-text email templates.
 *
 * Design Architecture:
 *  - Font: Clean, elegant system typography stack (Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
 *    which renders crisp in all email clients without layout shifting or missing webfont glitches.
 *  - Palette: Contemporary neutral canvas with clean card containers, soft border styling, and refined micro-typography.
 *  - High deliverability table-based structure engineered for Apple Mail, Gmail, Outlook & iOS/Android mail apps.
 */

// ─── Shared Theme Constants ───────────────────────────────────────────────────

const BRAND         = 'Whippie';
const COMPANY_NAME  = 'DAAR Communications Plc';

// Colors
const COLOR_PRIMARY = '#4F46E5'; // Indigo 600 - modern, tech-forward, high-contrast
const BG_BODY       = '#F8FAFC'; // Slate 50
const CARD_BG       = '#FFFFFF';
const CARD_BORDER   = '#E2E8F0'; // Slate 200
const TEXT_HEAD     = '#0F172A'; // Slate 900
const TEXT_BODY     = '#334155'; // Slate 700
const TEXT_MUTED    = '#64748B'; // Slate 500
const TEXT_SUBTLE   = '#94A3B8'; // Slate 400

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ─── Shared HTML Wrapper ───────────────────────────────────────────────────────

function wrap({
  preheader,
  badgeText,
  badgeBg,
  badgeColor,
  headingHtml,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  ctaColor,
  footerNote,
}: {
  preheader: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  headingHtml: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaColor?: string;
  footerNote: string;
}): string {
  const cta =
    ctaLabel && ctaUrl
      ? `
      <!-- Action CTA -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0;">
        <tr>
          <td align="left">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius: 8px; background: ${ctaColor ?? COLOR_PRIMARY};">
                  <a href="${esc(ctaUrl)}"
                     target="_blank"
                     style="display: inline-block; padding: 13px 28px; font-family: ${FONT_FAMILY}; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px; letter-spacing: -0.01em;">
                    ${esc(ctaLabel)} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Secondary Plain-text Link -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px; padding-top: 20px; border-top: 1px dashed ${CARD_BORDER};">
        <tr>
          <td>
            <p style="margin: 0; font-family: ${FONT_FAMILY}; font-size: 12px; line-height: 1.5; color: ${TEXT_MUTED};">
              Trouble clicking the button? Copy and paste this URL into your browser:
            </p>
            <p style="margin: 6px 0 0 0; font-family: ${FONT_FAMILY}; font-size: 12px; line-height: 1.4; color: ${COLOR_PRIMARY}; word-break: break-all;">
              <a href="${esc(ctaUrl)}" style="color: ${COLOR_PRIMARY}; text-decoration: underline;">${esc(ctaUrl)}</a>
            </p>
          </td>
        </tr>
      </table>
    `
      : '';

  const badge = badgeText
    ? `
      <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 20px; background: ${badgeBg ?? '#EEF2FF'}; color: ${badgeColor ?? COLOR_PRIMARY}; margin-bottom: 16px;">
        ${esc(badgeText)}
      </span>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${BRAND}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${BG_BODY};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    @media only screen and (max-width: 600px) {
      .outer-wrap { padding: 16px 8px !important; }
      .inner-card { padding: 28px 20px !important; border-radius: 12px !important; }
      .email-heading { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_BODY}; font-family: ${FONT_FAMILY};">

  <!-- Preheader preview text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer-wrap" style="background-color: ${BG_BODY}; padding: 48px 16px;">
    <tr>
      <td align="center">

        <!-- Header / Brand mark -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; margin-bottom: 24px;">
          <tr>
            <td align="left">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: ${COLOR_PRIMARY}; border-radius: 7px; width: 28px; height: 28px; text-align: center; vertical-align: middle;">
                    <span style="font-family: ${FONT_FAMILY}; font-size: 15px; font-weight: 800; color: #FFFFFF; line-height: 28px;">W</span>
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <span style="font-family: ${FONT_FAMILY}; font-size: 16px; font-weight: 700; color: ${TEXT_HEAD}; letter-spacing: -0.02em;">
                      ${BRAND}
                    </span>
                    <span style="margin-left: 6px; font-size: 12px; color: ${TEXT_SUBTLE}; font-weight: 400;">
                      · Intern Portal
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="inner-card"
               style="max-width: 540px; background-color: ${CARD_BG}; border: 1px solid ${CARD_BORDER}; border-radius: 14px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); padding: 40px 36px; text-align: left;">
          <tr>
            <td>
              ${badge}
              <div style="margin-bottom: 20px;">
                ${headingHtml}
              </div>

              <div>
                ${bodyHtml}
                ${cta}
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; margin-top: 24px; text-align: center;">
          <tr>
            <td style="padding: 0 12px;">
              <p style="margin: 0 0 6px 0; font-family: ${FONT_FAMILY}; font-size: 12px; line-height: 1.5; color: ${TEXT_MUTED};">
                ${esc(footerNote)}
              </p>
              <p style="margin: 0; font-family: ${FONT_FAMILY}; font-size: 12px; line-height: 1.5; color: ${TEXT_SUBTLE};">
                © ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}
              </p>
            </td>
          </tr>
        </table>

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
  return `<p style="margin: 0 0 16px 0; font-family: ${FONT_FAMILY}; font-size: 15px; line-height: 1.6; color: ${TEXT_BODY};">${s}</p>`;
}

function heading(s: string) {
  return `<h1 class="email-heading" style="margin: 0; font-family: ${FONT_FAMILY}; font-size: 22px; font-weight: 700; color: ${TEXT_HEAD}; letter-spacing: -0.025em; line-height: 1.3;">${s}</h1>`;
}

function highlight(s: string) {
  return `<strong style="color: ${TEXT_HEAD}; font-weight: 600;">${s}</strong>`;
}

function infoCard(lines: string[], borderColor = '#E2E8F0', bg = '#F8FAFC') {
  const rows = lines
    .map(
      (l) => `
    <tr>
      <td style="padding: 5px 0; font-family: ${FONT_FAMILY}; font-size: 13px; color: ${TEXT_BODY}; line-height: 1.5;">
        <span style="color: ${TEXT_MUTED}; margin-right: 8px;">•</span>${l}
      </td>
    </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin: 20px 0 4px 0; background-color: ${bg}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 14px 16px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
        </td>
      </tr>
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
  const subject = `Verify your email address for ${BRAND}`;

  const html = wrap({
    preheader: 'Please confirm your email address to complete your registration.',
    badgeText: 'Action Required',
    badgeBg: '#EEF2FF',
    badgeColor: '#4F46E5',
    headingHtml: heading(`Confirm your email, ${esc(input.firstName)}`),
    bodyHtml: `
      ${bodyText(`Thank you for signing up for the ${highlight(BRAND)} internship platform.`)}
      ${bodyText(`Please click the button below to verify your email address. Once verified, your profile will be queued for review by the HR team.`)}
      ${infoCard([
        `This link is valid for <strong>${input.expiresInHours} hour${input.expiresInHours === 1 ? '' : 's'}</strong>.`,
        'This link can only be used once.',
        "If you didn't create an account, you can safely ignore this message.",
      ])}
    `,
    ctaLabel: 'Verify Email Address',
    ctaUrl: input.verifyUrl,
    ctaColor: '#4F46E5',
    footerNote: `You received this email because you registered on the ${BRAND} portal.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Please verify your email address to complete your ${BRAND} registration.`,
    `Once confirmed, your account will be reviewed by HR.`,
    '',
    `Verify your email (valid for ${input.expiresInHours} hours):`,
    input.verifyUrl,
    '',
    `If you did not create this account, please ignore this email.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}`,
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

  const html = wrap({
    preheader: 'A password reset link has been generated for your account.',
    badgeText: 'Security Notice',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    headingHtml: heading(`Reset your password`),
    bodyHtml: `
      ${bodyText(`Hi ${esc(input.firstName)}, we received a request to reset the password for your ${highlight(BRAND)} account.`)}
      ${bodyText(`Click below to set a new password:`)}
      ${infoCard([
        `This reset link will expire in <strong>${input.expiresInMinutes} minutes</strong>.`,
        'For security, this link can only be used once.',
        "If you did not request this change, your credentials remain secure and no action is required.",
      ], '#FDE68A', '#FFFBEB')}
    `,
    ctaLabel: 'Reset Password',
    ctaUrl: input.resetUrl,
    ctaColor: '#D97706',
    footerNote: `You received this email because a password reset was requested for your account.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `We received a request to reset your password for your ${BRAND} account.`,
    '',
    `Reset link (expires in ${input.expiresInMinutes} minutes):`,
    input.resetUrl,
    '',
    `If you did not request this, no action is needed.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}`,
  ].join('\n');

  return { subject, html, text };
}

// ─── 3. Welcome (HR approved) ─────────────────────────────────────────────────

export interface WelcomeEmailInput {
  firstName: string;
  loginUrl: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const subject = `Your ${BRAND} account has been approved`;

  const html = wrap({
    preheader: 'Your profile has been approved by HR. You may now log in.',
    badgeText: 'Approved',
    badgeBg: '#ECFDF5',
    badgeColor: '#059669',
    headingHtml: heading(`Welcome aboard, ${esc(input.firstName)}`),
    bodyHtml: `
      ${bodyText(`Your ${highlight(BRAND)} internship account has been verified and approved by the HR administration team.`)}
      ${bodyText(`You can now sign in to your dashboard to access all features:`)}
      ${infoCard([
        'Daily GPS-verified check-in and attendance logging',
        'Direct task tracking, milestones, and project submissions',
        'Weekly activity logs and supervisor progress reviews',
      ], '#A7F3D0', '#F0FDF4')}
    `,
    ctaLabel: 'Go to Intern Dashboard',
    ctaUrl: input.loginUrl,
    ctaColor: '#059669',
    footerNote: `You received this email because your account was approved by HR.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Great news — your ${BRAND} internship account has been approved!`,
    `You can now sign in to access your attendance, tasks, and reports.`,
    '',
    `Login URL:`,
    input.loginUrl,
    '',
    `© ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}`,
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
  const subject = `Update regarding your ${BRAND} registration`;

  const reasonContent = input.rejectionReason
    ? infoCard([`Administrative note: <strong>${esc(input.rejectionReason)}</strong>`], '#FECDD3', '#FFF1F2')
    : '';

  const html = wrap({
    preheader: 'An update regarding the status of your intern registration.',
    badgeText: 'Registration Status',
    badgeBg: '#F1F5F9',
    badgeColor: '#475569',
    headingHtml: heading(`Application Update`),
    bodyHtml: `
      ${bodyText(`Hi ${esc(input.firstName)}, thank you for registering with the ${highlight(BRAND)} internship platform.`)}
      ${bodyText(`After review, your application could not be approved at this time.`)}
      ${reasonContent}
      ${bodyText(`If you believe this decision is in error or requires clarification, please contact your departmental coordinator or HR supervisor.`)}
    `,
    ctaLabel: 'Contact HR Support',
    ctaUrl: input.supportUrl,
    ctaColor: '#475569',
    footerNote: `You received this email regarding your registration status at ${BRAND}.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your interest in ${BRAND}.`,
    `After administrative review, your account application could not be approved at this time.`,
    input.rejectionReason ? `Reason: ${input.rejectionReason}` : '',
    '',
    `If you believe this is in error, please reach out to your HR administrator.`,
    '',
    `© ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}`,
  ]
    .filter((l): l is string => Boolean(l))
    .join('\n');

  return { subject, html, text };
}

// ─── 5. Supervisor welcome / invitation ────────────────────────────────────────

export interface SupervisorInviteEmailInput {
  firstName: string;
  email: string;
  temporaryPassword?: string;
  loginUrl: string;
  departmentName?: string;
}

export function renderSupervisorInviteEmail(input: SupervisorInviteEmailInput): RenderedEmail {
  const subject = `Welcome to ${BRAND} — Your Supervisor Account is Ready`;

  const credDetails = [
    `Official Email: <strong>${esc(input.email)}</strong>`,
  ];
  if (input.departmentName) {
    credDetails.push(`Department / SBU: <strong>${esc(input.departmentName)}</strong>`);
  }
  if (input.temporaryPassword) {
    credDetails.push(`Temporary Password: <strong style="font-family: monospace; font-size: 15px; letter-spacing: 0.05em;">${esc(input.temporaryPassword)}</strong>`);
  }

  const html = wrap({
    preheader: 'Your supervisor account has been created for DAAR Communications internship operations.',
    badgeText: 'Staff Account Created',
    badgeBg: '#EEF2FF',
    badgeColor: COLOR_PRIMARY,
    headingHtml: heading(`Welcome to ${BRAND}`),
    bodyHtml: `
      ${bodyText(`Hi ${esc(input.firstName)}, an official supervisor account has been provisioned for you by HR Administration.`)}
      ${infoCard(credDetails, '#C7D2FE', '#EEF2FF')}
      ${bodyText(`You can now sign in to the web portal to review assigned interns, track attendance, approve weekly reports, and complete milestone evaluations.`)}
      ${input.temporaryPassword ? bodyText(`<em>Please sign in and update your password under your profile settings.</em>`) : ''}
    `,
    ctaLabel: 'Sign in to Staff Portal',
    ctaUrl: input.loginUrl,
    footerNote: `You received this email because an administrative staff account was created for you at ${COMPANY_NAME}.`,
  });

  const text = [
    `Hi ${input.firstName},`,
    '',
    `An official supervisor account has been created for you on ${BRAND}.`,
    `Email: ${input.email}`,
    input.departmentName ? `Department: ${input.departmentName}` : '',
    input.temporaryPassword ? `Temporary Password: ${input.temporaryPassword}` : '',
    '',
    `Sign in here: ${input.loginUrl}`,
    '',
    `© ${new Date().getFullYear()} ${BRAND} · ${COMPANY_NAME}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
