import { checkInFaceField } from '../face/face.schema';
import { z } from 'zod';
import { CheckType, AttendanceStatus } from './attendance.types';

// ─── Check-in / check-out submission ─────────────────────────────────────────

export const checkInSchema = z.object({
  body: z.object({
    checkType: z.nativeEnum(CheckType).default(CheckType.CHECK_IN),
    latitude: z.number({ required_error: 'latitude is required' }),
    longitude: z.number({ required_error: 'longitude is required' }),
    locationAccuracy: z.number().positive().optional(),
    // Face check: selfie, fingerprints and liveness from the phone (check-in only)
    face: checkInFaceField,
    // Random ID the app stores on the phone, to spot one phone checking in two people
    deviceId: z.string().trim().min(8).max(64).optional(),
  }),
});

export type CheckInInput = z.infer<typeof checkInSchema>['body'];

// ─── HR correction ────────────────────────────────────────────────────────────

export const correctAttendanceSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: z.nativeEnum(AttendanceStatus),
    correctionNote: z
      .string({ required_error: 'A correction note is required' })
      .trim()
      .min(1)
      .max(500),
  }),
});

export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>['body'];

// ─── List query ───────────────────────────────────────────────────────────────

export const listAttendanceSchema = z.object({
  query: z.object({
    intern: z.string().optional(),
    status: z.string().optional(),
    checkType: z.string().optional(),
    late: z.enum(['true', 'false']).optional(),
    date: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    // A day's check-ins for every intern are shown on one page, so allow up to 500.
    limit: z.coerce.number().int().positive().max(500).default(30),
  }),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceSchema>['query'];
