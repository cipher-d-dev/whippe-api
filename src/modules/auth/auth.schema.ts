import { z } from 'zod';
import { Role } from './auth.types';

// ─── Signup ───────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must not exceed 72 characters'),  // bcrypt max
    firstName: z
      .string({ required_error: 'First name is required' })
      .trim()
      .min(1, 'First name is required')
      .max(100),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .trim()
      .min(1, 'Last name is required')
      .max(100),
    role: z.nativeEnum(Role, {
      required_error: 'Role is required',
      invalid_type_error: `Role must be one of: ${Object.values(Role).join(', ')}`,
    }),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>['body'];

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];

// ─── Resend verification email ───────────────────────────────────────────────

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
  }),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];

// ─── Forgot password ─────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
  }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];

// ─── Reset password ──────────────────────────────────────────────────────────
// Stronger validation than signup — password reset should force a decent
// password. We require length AND at least one letter and one number.

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: 'Token is required' })
      .min(1, 'Token is required'),
    password: z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must not exceed 72 characters')
      .refine(
        (pw) => /[a-zA-Z]/.test(pw) && /\d/.test(pw),
        'Password must contain at least one letter and one number',
      ),
  }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];

// ─── Verify email (POST — frontend calls this with the token from the URL) ────

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: 'Token is required' })
      .min(1, 'Token is required'),
  }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];

// ─── Auth method detection ────────────────────────────────────────────────────

export const authMethodQuerySchema = z.object({
  query: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase(),
  }),
});

export type AuthMethodQuery = z.infer<typeof authMethodQuerySchema>['query'];

// ─── Link password ────────────────────────────────────────────────────────────

export const linkPasswordSchema = z.object({
  body: z.object({
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must not exceed 72 characters')
      .refine(
        (pw) => /[a-zA-Z]/.test(pw) && /\d/.test(pw),
        'Password must contain at least one letter and one number',
      ),
  }),
});

export type LinkPasswordInput = z.infer<typeof linkPasswordSchema>['body'];

// ─── Change password (authenticated) ──────────────────────────────────────────

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'New password must be at least 8 characters')
      .max(72, 'New password must not exceed 72 characters')
      .refine(
        (pw) => /[a-zA-Z]/.test(pw) && /\d/.test(pw),
        'New password must contain at least one letter and one number',
      ),
  }),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
