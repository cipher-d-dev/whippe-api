import { AccountStatus, AuthMethod, Role } from '../auth/auth.types';

/**
 * The safe public representation of a User document.
 * passwordHash and refreshTokenHash are never included.
 */
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: AccountStatus;
  authMethod: AuthMethod;
  verificationExpiresAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pagination envelope used for list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
