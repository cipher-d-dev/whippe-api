import { z } from 'zod';

// ─── Create ───────────────────────────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Department name is required' })
      .trim()
      .min(1, 'Department name is required')
      .max(200),
    description: z.string().trim().max(500).optional(),
    subsidiary: z.string().trim().max(100).optional(),
  }),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>['body'];

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateDepartmentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(500).optional(),
      subsidiary: z.string().trim().max(100).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>['body'];

// ─── List query ───────────────────────────────────────────────────────────────

export const listDepartmentsSchema = z.object({
  query: z.object({
    subsidiary: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsSchema>['query'];
