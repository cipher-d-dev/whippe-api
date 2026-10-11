import mongoose from 'mongoose';
import { Attendance, IAttendanceDocument } from './attendance.model';
import { Intern } from '../interns/intern.model';
import { AttendanceStatus, CheckType } from './attendance.types';
import { checkGeofence } from '../../lib/geofence';
import { createError } from '../../middleware/error-handler';
import { env } from '../../config/env';
import {
  CheckInInput,
  CorrectAttendanceInput,
  ListAttendanceQuery,
} from './attendance.schema';
import { PaginatedResponse } from '../users/user.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips the time portion from a date — gives us a per-day key for uniqueness */
function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const POOR_ACCURACY_THRESHOLD_METERS = 50; // flag if accuracy > 50m

// ─── checkIn ─────────────────────────────────────────────────────────────────

export async function checkIn(
  userId: string,
  input: CheckInInput,
  ipAddress: string,
  userAgent: string,
): Promise<IAttendanceDocument> {
  // Resolve intern record from the authenticated user
  const intern = await Intern.findOne({ user: userId });
  if (!intern) throw createError('No intern record found for this account.', 404);

  const now = new Date();
  const today = toDateOnly(now);

  // Prevent duplicate check-in/out on the same day
  const duplicate = await Attendance.findOne({
    intern: intern._id,
    date: today,
    checkType: input.checkType,
  });
  if (duplicate) {
    throw createError(
      `You have already submitted a ${input.checkType.replace('_', '-').toLowerCase()} for today.`,
      409,
    );
  }

  // ── Geofence evaluation ────────────────────────────────────────────────────
  const { distanceMeters, withinGeofence } = checkGeofence(
    input.latitude,
    input.longitude,
    env.OFFICE_LAT,
    env.OFFICE_LNG,
    env.OFFICE_RADIUS_METERS,
  );

  // ── Determine status and flag reasons ─────────────────────────────────────
  const flagReasons: string[] = [];

  if (!withinGeofence) flagReasons.push('OUTSIDE_GEOFENCE');

  if (
    input.locationAccuracy !== undefined &&
    input.locationAccuracy > POOR_ACCURACY_THRESHOLD_METERS
  ) {
    flagReasons.push('POOR_LOCATION_ACCURACY');
  }

  let status: AttendanceStatus;

  if (!withinGeofence) {
    // Outside geofence → outright rejected
    status = AttendanceStatus.REJECTED;
  } else if (flagReasons.length > 0) {
    // Inside geofence but other concerns → flag for HR review
    status = AttendanceStatus.FLAGGED;
  } else {
    status = AttendanceStatus.ACCEPTED;
  }

  return Attendance.create({
    intern: intern._id,
    date: today,
    checkType: input.checkType,
    status,
    submittedAt: now,
    latitude: input.latitude,
    longitude: input.longitude,
    locationAccuracy: input.locationAccuracy,
    distanceFromOffice: distanceMeters,
    withinGeofence,
    ipAddress,
    userAgent,
    flagReasons: flagReasons.length > 0 ? flagReasons : undefined,
  });
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listAttendance(
  query: ListAttendanceQuery,
): Promise<PaginatedResponse<IAttendanceDocument>> {
  const { page, limit, intern, status, checkType, from, to } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (intern && mongoose.isValidObjectId(intern)) {
    filter['intern'] = new mongoose.Types.ObjectId(intern);
  }
  if (status) filter['status'] = status;
  if (checkType) filter['checkType'] = checkType;
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter['$gte'] = from;
    if (to) dateFilter['$lte'] = to;
    filter['date'] = dateFilter;
  }

  const [data, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1, submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('intern', 'firstName lastName'),
    Attendance.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── getById ─────────────────────────────────────────────────────────────────

export async function getAttendanceById(id: string): Promise<IAttendanceDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid attendance ID.', 400);

  const record = await Attendance.findById(id)
    .select('+ipAddress +userAgent')
    .populate('intern', 'firstName lastName');

  if (!record) throw createError('Attendance record not found.', 404);
  return record;
}

// ─── HR correction ────────────────────────────────────────────────────────────

export async function correctAttendance(
  id: string,
  input: CorrectAttendanceInput,
  hrUserId: string,
): Promise<IAttendanceDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid attendance ID.', 400);

  const record = await Attendance.findByIdAndUpdate(
    id,
    {
      status: input.status,
      correctedBy: new mongoose.Types.ObjectId(hrUserId),
      correctedAt: new Date(),
      correctionNote: input.correctionNote,
    },
    { new: true },
  ).populate('intern', 'firstName lastName');

  if (!record) throw createError('Attendance record not found.', 404);
  return record;
}

// ─── Intern's own history ─────────────────────────────────────────────────────

export async function getMyAttendance(
  userId: string,
  query: ListAttendanceQuery,
): Promise<PaginatedResponse<IAttendanceDocument>> {
  const intern = await Intern.findOne({ user: userId });
  if (!intern) throw createError('No intern record found for this account.', 404);

  return listAttendance({ ...query, intern: (intern._id as mongoose.Types.ObjectId).toString() });
}
