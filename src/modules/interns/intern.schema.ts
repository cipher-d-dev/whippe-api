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

    middleName: z.string().trim().max(100).optional(),

    lastName: z
      .string({ required_error: 'Last name is required' })
      .trim()
      .min(1, 'Last name is required')
      .max(100),

    gender: z.enum(['MALE', 'FEMALE']).optional(),

    phone: z.string().trim().max(30).optional(),

    address: z.string().trim().max(300).optional(),

    institution: z.string().trim().max(200).optional(),

    institutionLocation: z.string().trim().max(200).optional(),

    course: z.string().trim().max(200).optional(),

    level: z.string().trim().max(50).optional(),

    stateCode: z.string().trim().max(50).optional(),
    callUpNumber: z.string().trim().max(50).optional(),

    internshipType: z.nativeEnum(InternshipType, {
      required_error: 'Internship type is required',
      invalid_type_error: `Internship type must be one of: ${Object.values(InternshipType).join(', ')}`,
    }),

    status: z.nativeEnum(InternshipStatus).optional(),
    receivesAllowance: z.boolean().optional(),

    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
    // Corps members are graduates: institution, level and course are optional for them.
    // SIWES/IT interns still need institution and course of study.
    .refine(
      (data) => data.internshipType !== InternshipType.INTERNSHIP || !!data.institution?.trim(),
      { message: 'Institution is required for students on industrial training', path: ['institution'] },
    )
    .refine(
      (data) => data.internshipType !== InternshipType.INTERNSHIP || !!data.course?.trim(),
      { message: 'Course of study/discipline is required for students on industrial training', path: ['course'] },
    ),
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
      middleName: z.string().trim().max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      phone: z.string().trim().max(30).optional(),
      address: z.string().trim().max(300).optional(),
      institution: z.string().trim().min(1).max(200).optional(),
      institutionLocation: z.string().trim().max(200).optional(),
      course: z.string().trim().min(1).max(200).optional(),
      level: z.string().trim().max(50).optional(),
      stateCode: z.string().trim().max(50).optional(),
      callUpNumber: z.string().trim().max(50).optional(),
      internshipType: z.nativeEnum(InternshipType).optional(),
      status: z.nativeEnum(InternshipStatus).optional(),
      // null = go back to the default for their type
      receivesAllowance: z.boolean().nullable().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .strict(),
});

export type UpdateInternInput = z.infer<typeof updateInternSchema>['body'];

// ─── Intern-permitted update fields ──────────────────────────────────────────
// These are the only fields an intern may update on their own record.

// Interns and corps members fill in their own personal, school and NYSC details.
// Name, type, status, dates, department and supervisor stay with HR.
export const INTERN_PERMITTED_UPDATE_FIELDS: (keyof UpdateInternInput)[] = [
  'middleName',
  'gender',
  'phone',
  'address',
  'institution',
  'institutionLocation',
  'course',
  'level',
  'stateCode',
  'callUpNumber',
];

// ─── List query ───────────────────────────────────────────────────────────────

export const listInternsSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    internshipType: z.string().optional(),
    department: z.string().optional(),
    supervisor: z.string().optional(),
    search: z.string().optional(),
    allowance: z.enum(['yes', 'no']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type ListInternsQuery = z.infer<typeof listInternsSchema>['query'];
