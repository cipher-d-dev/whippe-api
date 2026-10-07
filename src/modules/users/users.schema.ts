import { z } from 'zod';

// ─── Approve ──────────────────────────────────────────────────────────────────

export const approveUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
});

export type ApproveUserParams = z.infer<typeof approveUserSchema>['params'];

// ─── Reject ───────────────────────────────────────────────────────────────────

export const rejectUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
  body: z.object({
    reason: z
      .string({ required_error: 'Rejection reason is required' })
      .trim()
      .min(1, 'Rejection reason is required')
      .max(500, 'Rejection reason must not exceed 500 characters'),
  }),
});

export type RejectUserParams = z.infer<typeof rejectUserSchema>['params'];
export type RejectUserBody = z.infer<typeof rejectUserSchema>['body'];

// ─── List query ───────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    role: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
