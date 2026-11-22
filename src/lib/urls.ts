import { env } from '../config/env';
import { Role } from '../modules/auth/auth.types';

/** Base URL of the staff portal (whippie-web) used for HR and supervisor emails. */
export function staffPortalUrl(): string {
  return (env.ADMIN_URL ?? env.FRONTEND_URL).replace(/\/+$/, '');
}

/** Base URL of the app a user signs in to: staff portal for HR/supervisors, intern app for interns. */
export function appUrlFor(role: Role): string {
  return role === Role.INTERN ? env.FRONTEND_URL.replace(/\/+$/, '') : staffPortalUrl();
}
