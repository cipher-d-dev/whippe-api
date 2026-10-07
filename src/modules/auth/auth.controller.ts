import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { signupSchema, loginSchema } from './auth.schema';
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
      message: 'Account created. Pending HR verification.',
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
