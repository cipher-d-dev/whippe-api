import { Router } from 'express';
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

// ─── Password auth (public) ───────────────────────────────────────────────────

// POST /api/v1/auth/signup
router.post('/signup', signupHandler);

// POST /api/v1/auth/login
router.post('/login', loginHandler);

// POST /api/v1/auth/refresh  — reads refresh token from HTTP-only cookie
router.post('/refresh', refreshHandler);

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
