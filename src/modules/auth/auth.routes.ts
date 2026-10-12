import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth';
import {
  signupHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
} from './auth.controller';
import {
  googleAuthHandler,
  googleCallbackHandler,
} from './auth.google.controller';

const router = Router();

// Auth-specific rate limit: 15 attempts per 15 minutes per IP.
// Much stricter than the global 200/15min to slow down brute-force attacks.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

// ─── Password auth (public) ───────────────────────────────────────────────────

// POST /api/v1/auth/signup
router.post('/signup', authLimiter, signupHandler);

// POST /api/v1/auth/login
router.post('/login', authLimiter, loginHandler);

// POST /api/v1/auth/refresh  — reads refresh token from HTTP-only cookie
router.post('/refresh', authLimiter, refreshHandler);

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

export default router;
