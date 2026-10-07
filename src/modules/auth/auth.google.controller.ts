import { Request, Response, NextFunction } from 'express';
import passport from '../../lib/passport';
import { IUserDocument } from '../users/user.model';
import { AccountStatus, Role } from './auth.types';
import {
  signAccessToken,
  signRefreshToken,
  hashRefreshToken,
  refreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from '../../lib/token';
import { User } from '../users/user.model';
import { env } from '../../config/env';

/**
 * GET /api/v1/auth/google
 * Redirects the browser to Google's consent screen.
 */
export const googleAuthHandler = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

/**
 * GET /api/v1/auth/google/callback
 * Google redirects back here after the user grants consent.
 *
 * On success: issues JWT pair, sets refresh cookie, redirects to the
 * frontend with the access token as a query param so the client can
 * store it in memory.
 *
 * On failure: redirects to the frontend login page with an error flag.
 */
export function googleCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  passport.authenticate(
    'google',
    { session: false },
    async (err: Error | null, user: IUserDocument | false) => {
      if (err || !user) {
        res.redirect(`${env.FRONTEND_URL}/auth/login?error=google_failed`);
        return;
      }

      try {
        if (user.status === AccountStatus.REJECTED) {
          res.redirect(`${env.FRONTEND_URL}/auth/login?error=account_rejected`);
          return;
        }

        // Issue tokens
        const accessToken = signAccessToken({
          userId: user.id as string,
          role: user.role as Role,
          status: user.status as AccountStatus,
        });
        const refreshToken = signRefreshToken(user.id as string);
        const refreshTokenHash = hashRefreshToken(refreshToken);

        // Persist the refresh token hash
        await User.findByIdAndUpdate(user.id, { refreshTokenHash });

        // Set the refresh token as an HTTP-only cookie
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions());

        // Redirect to frontend with the access token in the URL fragment.
        // The client reads it from window.location.hash, stores it in memory,
        // then immediately clears the hash from the URL.
        res.redirect(`${env.FRONTEND_URL}/auth/google/success#token=${accessToken}`);
      } catch (callbackErr) {
        next(callbackErr);
      }
    },
  )(req, res, next);
}
