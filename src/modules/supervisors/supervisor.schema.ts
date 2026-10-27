import { z } from 'zod';

export const createSupervisorSchema = z.object({
  body: z.object({
    userId:     z.string().optional(),
    email:      z.string().email('Invalid email address').toLowerCase().optional(),
    password:   z.string().min(8, 'Password must be at least 8 characters').optional(),
    firstName:  z.string({ required_error: 'First name is required' }).trim().min(1).max(100),
    lastName:   z.string({ required_error: 'Last name is required' }).trim().min(1).max(100),
    phone:      z.string().trim().max(30).optional(),
    department: z.string().optional(), // ObjectId string — validated in service
  }).refine((data) => data.userId || data.email, {
    message: 'Either a staff account (userId) or an email address must be provided',
    path: ['email'],
  }),
});

export type CreateSupervisorInput = z.infer<typeof createSupervisorSchema>['body'];

export const updateSupervisorSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      firstName:  z.string().trim().min(1).max(100).optional(),
      lastName:   z.string().trim().min(1).max(100).optional(),
      phone:      z.string().trim().max(30).optional(),
      department: z.string().optional(),
      isActive:   z.boolean().optional(),
    })
    .strict(),
});

export type UpdateSupervisorInput = z.infer<typeof updateSupervisorSchema>['body'];

export const listSupervisorsSchema = z.object({
  query: z.object({
    department: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page:  z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type ListSupervisorsQuery = z.infer<typeof listSupervisorsSchema>['query'];
