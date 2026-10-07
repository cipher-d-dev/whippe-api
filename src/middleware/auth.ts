import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/token';
import { AuthenticatedUser } from '../modules/auth/auth.types';

/**
 * authenticate
 *
 * Verifies the access token from the Authorization header.
 * Attaches the decoded user to req.user on success.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyAccessToken(token);

    // Cast through unknown — req.user is Express.User which has optional fields,
    // but we guarantee all fields are present from a valid access token payload.
    req.user = {
      id: payload.sub,
      role: payload.role,
      status: payload.status,
    } as unknown as Express.User;

    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * getAuthUser
 *
 * Typed helper used in controllers after authenticate middleware runs.
 * Asserts req.user as AuthenticatedUser so downstream code has non-optional fields.
 */
export function getAuthUser(req: Request): AuthenticatedUser {
  return req.user as unknown as AuthenticatedUser;
}
