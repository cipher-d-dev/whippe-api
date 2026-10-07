import { z } from 'zod';
import { InternshipType, InternshipStatus } from './intern.types';

// ─── Create ───────────────────────────────────────────────────────────────────
// HR creates an intern record. userId links the record to an existing account.

export const createInternSchema = z.object({
  body: z.object({
    userId: z
      .string({ required_error: 'userId is required' })
      .min(1, 'userId is required'),

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

    phone: z.string().trim().max(30).optional(),

    address: z.string().trim().max(300).optional(),

    institution: z
      .string({ required_error: 'Institution is required' })
      .trim()
      .min(1, 'Institution is required')
      .max(200),

    course: z
      .string({ required_error: 'Course is required' })
      .trim()
      .min(1, 'Course is required')
      .max(200),

    level: z.string().trim().max(50).optional(),

    internshipType: z.nativeEnum(InternshipType, {
      required_error: 'Internship type is required',
      invalid_type_error: `Internship type must be one of: ${Object.values(InternshipType).join(', ')}`,
    }),

    status: z.nativeEnum(InternshipStatus).optional(),

    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

export type CreateInternInput = z.infer<typeof createInternSchema>['body'];

// ─── Update ───────────────────────────────────────────────────────────────────
// HR can update any field. Interns can update a limited subset (enforced in service).

export const updateInternSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      phone: z.string().trim().max(30).optional(),
      address: z.string().trim().max(300).optional(),
      institution: z.string().trim().min(1).max(200).optional(),
      course: z.string().trim().min(1).max(200).optional(),
      level: z.string().trim().max(50).optional(),
      internshipType: z.nativeEnum(InternshipType).optional(),
      status: z.nativeEnum(InternshipStatus).optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .strict(),
});

export type UpdateInternInput = z.infer<typeof updateInternSchema>['body'];

// ─── Intern-permitted update fields ──────────────────────────────────────────
// These are the only fields an intern may update on their own record.

export const INTERN_PERMITTED_UPDATE_FIELDS: (keyof UpdateInternInput)[] = [
  'phone',
  'address',
];

// ─── List query ───────────────────────────────────────────────────────────────

export const listInternsSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    internshipType: z.string().optional(),
    department: z.string().optional(),
    supervisor: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type ListInternsQuery = z.infer<typeof listInternsSchema>['query'];
