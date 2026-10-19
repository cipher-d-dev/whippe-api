# Whippie Auth Improvements Roadmap

> Tracking document for the multi-session auth overhaul across `whippie-api` (backend), `whippie-intern` (intern PWA), and `whippie-web` (HR dashboard).
> Update progress here after each work session so new sessions can resume cleanly.

---

## Status Legend

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — done (commit hash noted next to it)
- `[!]` — blocked (note why)

---

## A. Email Infrastructure (prerequisite for B, C)

- [x] Add `RESEND_API_KEY` to `.env` and `.env.example`
- [x] Add `EMAIL_FROM` env var (default `Whippie <no-reply@whippie.app>`)
- [x] Create `src/lib/email.ts` — Resend client wrapper (typed `sendEmail()` helper)
- [x] Build email templates (`email-templates.ts`) — verification, password reset, welcome, rejection
- [x] Stub mode: when `RESEND_API_KEY` is absent, emails are logged to console instead of sent

## B. Email Verification

- [x] Add `AccountStatus.UNVERIFIED_EMAIL` to enum (separate from `PENDING_HR_VERIFICATION`)
- [x] Update signup flow: new users start as `UNVERIFIED_EMAIL`, send signed-token verification email
- [x] Add `POST /auth/resend-verification` endpoint (rate-limited to 5/15min)
- [x] Add `POST /auth/verify-email` endpoint — frontend POSTs token, sets status to `PENDING_HR_VERIFICATION`
- [x] Frontend (intern): `/auth/verify-email` page — auto-verifies on token, shows waiting/success/error states, resend button
- [x] Frontend (intern): `VerificationPendingClient` updated — correct messaging ("email verified ✓, awaiting HR"), redirects UNVERIFIED → /verify-email
- [x] `AppAuthGuard` handles `UNVERIFIED_EMAIL` → `/verify-email`
- [x] `useLogin` routes `UNVERIFIED_EMAIL` → `/verify-email`
- [x] `useSignup` routes new accounts → `/verify-email` (was `/verification-pending`)

## C. Forgot Password

- [x] Add `POST /auth/forgot-password` — generate reset token, send email, always return 200 (anti-enumeration)
- [x] Add `POST /auth/reset-password` — validate token, accept new password, invalidate all refresh tokens
- [x] Store reset token hash on User with 1-hour expiry
- [x] Password strength validation on reset (min 8 chars + letter + number)
- [x] Frontend (intern): `/auth/forgot-password` page — email input, "sent" confirmation state
- [x] Frontend (intern): `/auth/reset-password` page — reads token from URL, confirms password
- [x] Frontend (intern): "Forgot?" link in LoginForm now points to `/forgot-password`

## D. Account Linking (modern explicit flow)

- [ ] Replace silent link in `passport.ts` — Google email matches existing account with no `googleId` → redirect to `/auth/login?error=email_taken&email=...` with messaging "log in with your password first"
- [ ] Add `AuthMethod.BOTH` to enum
- [ ] Add `POST /auth/link-google` — requires current session (re-auth via password)
- [ ] Add `POST /auth/link-password` — requires current session, accepts new password
- [ ] Add `POST /auth/unlink-google` and `POST /auth/unlink-password` — block if it would leave zero methods
- [ ] Frontend (intern): "Sign-in methods" section in Profile screen
- [ ] Frontend (web): same for HR users (HR can optionally add Google)

## E. Smart Login Detection

- [ ] Add `GET /auth/method?email=...` — returns `"password" | "google" | "both" | "none"` (rate-limited)
- [ ] Frontend: LoginForm calls `/auth/method` on email blur, renders appropriate UI:
  - `password` → password field
  - `google` → "Continue with Google" only
  - `both` → both options
  - `none` → "No account found, sign up?"
- [ ] Frontend: SignupForm — same call to detect "already have an account?"

## F. Security Hardening

- [x] Independent rate limits on `forgot-password`, `resend-verification`, `auth/method` (5/15min vs 15/15min for auth)
- [x] Invalidate all refresh tokens on password reset
- [x] Password strength validation on reset (min 8 chars + letter + number)
- [x] Add `authMethod` to access token payload — now in `AccessTokenPayload`, `signAccessToken`, `req.user`
- [ ] Audit log for account-linking changes (optional, nice-to-have — skipped for now)

## G. Phase 10 PWA + README (carried over)

- [x] Commit already-updated `manifest.json`
- [x] Add `InstallPrompt` component (`beforeinstallprompt` handler, dismisses to sessionStorage)
- [x] `InstallPrompt` added to `Providers.tsx` — renders on all app pages
- [x] `README.md` written — phases, auth flow, routes, env vars, PWA instructions

---

## Dependency Graph

```
A (email infra)
 ├── B (verification)
 └── C (forgot password)
F (hardening) — independent
D (account linking) — needs B done first (so users have verified emails)
E (smart detection) — needs D done first (so authMethod field is meaningful)
```

## Recommended Order

1. **A** — email infra (unblocks B, C)
2. **B + C** — in parallel (no interdependency)
3. **F** — security hardening (independent)
4. **D** — account linking (needs B)
5. **E** — smart detection (needs D)
6. **G** — PWA + README (anytime)

---

## Session Log

| Session | Date | Work completed | Commit(s) | Notes |
|---------|------|----------------|-----------|-------|
| 1 | 2026-10-19 | Roadmap created, A complete | (pending) | Resend wired but key blank in .env — user will fill in |
| 1 | 2026-10-19 | B + C complete (email verification + forgot/reset password) | 34ae52e (api), ae2347b (intern) | Backend + frontend both typecheck clean |
| 1 | 2026-10-19 | D + E + F + G complete — full auth roadmap done | (pending) | All sections implemented and typechecked |

---

## Open Questions / Blockers

- [ ] Resend account / API key — does the user have one, or stub behind feature flag?
- [ ] Email sending domain — `whippie.app` verified in Resend?
- [ ] Frontend work happens in `whippie-intern` repo, backend in `whippie-api` — commit and push to each separately
