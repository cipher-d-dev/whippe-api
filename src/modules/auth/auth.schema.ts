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
