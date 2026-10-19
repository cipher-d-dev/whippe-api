// ─── Roles ───────────────────────────────────────────────────────────────────

export enum Role {
  HR = 'HR',
  SUPERVISOR = 'SUPERVISOR',
  INTERN = 'INTERN',
}

// ─── Account status ───────────────────────────────────────────────────────────
// Separate from internship status — see 05-WHIPPE-SHARED-BACKEND-DATA.md
//
// Lifecycle:
//   UNVERIFIED_EMAIL          → user signed up, hasn't clicked email link yet
//   PENDING_HR_VERIFICATION   → email verified, waiting for HR to approve
//   ACTIVE                    → HR approved, full access
//   REJECTED                  → HR rejected the account

export enum AccountStatus {
  UNVERIFIED_EMAIL = 'UNVERIFIED_EMAIL',
  PENDING_HR_VERIFICATION = 'PENDING_HR_VERIFICATION',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
}

// ─── Auth method ─────────────────────────────────────────────────────────────

export enum AuthMethod {
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
  BOTH = 'BOTH',   // account has both password and Google linked
}

// ─── JWT payload shapes ──────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;   // User._id as string
  role: Role;
  status: AccountStatus;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;   // User._id as string
  iat?: number;
  exp?: number;
}

// ─── Authenticated request extension ─────────────────────────────────────────
// Attached to req by the authenticate middleware.

export interface AuthenticatedUser {
  id: string;
  role: Role;
  status: AccountStatus;
}

// Merge into passport's Express.User.
// id is optional here because Mongoose Document.id is string | undefined.
// The authenticate middleware always guarantees id is present before setting req.user.
declare global {
  namespace Express {
    interface User {
      id?: string;
      role?: Role;
      status?: AccountStatus;
    }
  }
}
