import { Request, Response, NextFunction } from 'express';
import { Role } from '../modules/auth/auth.types';
import { getAuthUser } from './auth';

/**
 * authorize(...roles)
 *
 * Role-based access control middleware.
 * Must be used after authenticate — relies on req.user being set.
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize(Role.HR), handler)
 *   router.get('/work',  authenticate, authorize(Role.HR, Role.SUPERVISOR), handler)
 */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const user = getAuthUser(req);

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
}
