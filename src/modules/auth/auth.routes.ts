import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth';
import {
  signupHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
  resendVerificationHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  authMethodHandler,
  linkPasswordHandler,
  unlinkGoogleHandler,
  unlinkPasswordHandler,
  changePasswordHandler,
} from './auth.controller';
import {
  googleAuthHandler,
  googleCallbackHandler,
} from './auth.google.controller';

const router = Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

// Auth (login, signup, refresh) — 15 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

// Email endpoints — stricter: 5 per 15 minutes (prevents email spam)
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait 15 minutes before trying again.',
  },
});

// ─── Password auth (public) ───────────────────────────────────────────────────

// POST /api/v1/auth/signup
router.post('/signup', authLimiter, signupHandler);

// POST /api/v1/auth/login
router.post('/login', authLimiter, loginHandler);

// POST /api/v1/auth/refresh  — reads refresh token from HTTP-only cookie
router.post('/refresh', authLimiter, refreshHandler);

// ─── Email verification ───────────────────────────────────────────────────────

// GET /api/v1/auth/verify-email?token=...  (clicked from email — frontend page reads the query param and POSTs it)
// POST /api/v1/auth/verify-email  (frontend submits the token here)
router.post('/verify-email', verifyEmailHandler);

// POST /api/v1/auth/resend-verification  (user requests a new link)
router.post('/resend-verification', emailLimiter, resendVerificationHandler);

// ─── Password reset ───────────────────────────────────────────────────────────

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', emailLimiter, forgotPasswordHandler);

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, resetPasswordHandler);

// ─── Smart login detection ─────────────────────────────────────────────────────

// GET /api/v1/auth/method?email=...
router.get('/method', emailLimiter, authMethodHandler);

// ─── Google OAuth ─────────────────────────────────────────────────────────────

// GET /api/v1/auth/google  — redirects to Google consent screen
router.get('/google', googleAuthHandler);

// GET /api/v1/auth/google/callback  — Google redirects back here
router.get('/google/callback', googleCallbackHandler);

// ─── Protected ────────────────────────────────────────────────────────────────

// POST /api/v1/auth/logout
router.post('/logout', authenticate, logoutHandler);

// GET /api/v1/auth/me
router.get('/me', authenticate, getMeHandler);

// ─── Account linking (protected — must be authenticated) ───────────────────────

// POST /api/v1/auth/link-password   — add a password to a Google-only account
router.post('/link-password', authenticate, linkPasswordHandler);

// POST /api/v1/auth/unlink-google   — remove Google from a BOTH account
router.post('/unlink-google', authenticate, unlinkGoogleHandler);

// POST /api/v1/auth/unlink-password — remove password from a BOTH account
router.post('/unlink-password', authenticate, unlinkPasswordHandler);

// POST /api/v1/auth/change-password — update password for logged-in user
router.post('/change-password', authenticate, authLimiter, changePasswordHandler);

export default router;
