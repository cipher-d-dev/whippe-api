import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import {
  signupSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schema';
import {
  REFRESH_TOKEN_COOKIE,
  refreshTokenCookieOptions,
  clearRefreshTokenCookieOptions,
} from '../../lib/token';
import { getAuthUser } from '../../middleware/auth';

// ─── POST /auth/signup ────────────────────────────────────────────────────────

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = signupSchema.parse({ body: req.body });
    const { user, accessToken, refreshToken } = await authService.signup(body);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      refreshTokenCookieOptions(),
    );

    res.status(201).json({
      success: true,
      message: 'Account created. Check your email to verify your address.',
      data: {
        accessToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const { user, accessToken, refreshToken } = await authService.login(body);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      refreshTokenCookieOptions(),
    );

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        accessToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawToken) {
      res.status(401).json({ success: false, message: 'No refresh token provided.' });
      return;
    }

    const { accessToken, refreshToken } = await authService.refresh(rawToken);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      refreshTokenCookieOptions(),
    );

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/logout ────────────────────────────────────────────────────────

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.user) {
      const user = getAuthUser(req);
      await authService.logout(user.id);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshTokenCookieOptions());

    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

export async function getMeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthUser(req);
    const me = await authService.getMe(user.id);

    res.status(200).json({
      success: true,
      data: { user: me },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/resend-verification ────────────────────────────────────────────

export async function resendVerificationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = resendVerificationSchema.parse({ body: req.body });
    await authService.resendVerificationEmail(body.email);

    // Always 200 — anti-enumeration. We never reveal whether the email exists.
    res.status(200).json({
      success: true,
      message:
        'If an account with that email is unverified, a new verification link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/verify-email ──────────────────────────────────────────────────
// Frontend reads the token from the email-link URL and POSTs it here.

export async function verifyEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = verifyEmailSchema.parse({ body: req.body });
    const result = await authService.verifyEmail(body.token);

    if (!result.ok) {
      res.status(400).json({
        success: false,
        message:
          result.reason === 'expired'
            ? 'This verification link has expired. Please request a new one.'
            : 'Invalid verification link.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. Your account is now awaiting HR review.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = forgotPasswordSchema.parse({ body: req.body });
    await authService.requestPasswordReset(body.email);

    // Always 200 — anti-enumeration. We never reveal whether the email exists.
    res.status(200).json({
      success: true,
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/reset-password ────────────────────────────────────────────────

export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = resetPasswordSchema.parse({ body: req.body });
    await authService.resetPassword(body.token, body.password);

    res.status(200).json({
      success: true,
      message:
        'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}
