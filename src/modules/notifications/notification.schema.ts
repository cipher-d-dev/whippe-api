import { z } from 'zod';

// ─── List notifications query params ─────────────────────────────────────────

export const listNotificationsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  read: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

export const broadcastNotificationSchema = z.object({
  target: z.enum(['INTERNS', 'SUPERVISORS', 'BOTH']),
  title: z.string().min(1, 'Title is required').max(120, 'Title too long'),
  body: z.string().min(1, 'Message body is required').max(1000, 'Message body too long'),
});

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;

