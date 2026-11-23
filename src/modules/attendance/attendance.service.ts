import mongoose from 'mongoose';
import { Attendance, IAttendanceDocument } from './attendance.model';
import { Intern } from '../interns/intern.model';
import { AttendanceStatus, CheckType } from './attendance.types';
import { checkGeofence } from '../../lib/geofence';
import { createError } from '../../middleware/error-handler';
import { evaluateCheckInFace, CheckInFaceResult } from '../face/face.service';
import { env } from '../../config/env';
import {
  CheckInInput,
  CorrectAttendanceInput,
  ListAttendanceQuery,
} from './attendance.schema';
import { PaginatedResponse } from '../users/user.types';
import { notifyAllHR } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips the time portion from a date — gives us a per-day key for uniqueness */
function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Earliest check-out after a check-in, in minutes (stops accidental double taps). */
export const MIN_MINUTES_BEFORE_CHECKOUT = 30;

export const POOR_ACCURACY_THRESHOLD_METERS = 50; // flag if accuracy > 50m

// ─── getGeofence ──────────────────────────────────────────────────────────────
// The office zone the check-in is judged against, so the intern app can show
// "inside / outside the zone" before the intern submits. Uses the same values
// checkIn() uses, so the preview can never disagree with the real decision.
// The HQ location is not sensitive; the server still re-checks every check-in.

export interface GeofenceInfo {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  poorAccuracyThresholdMeters: number;
}

export function getGeofence(): GeofenceInfo {
  return {
    latitude: env.OFFICE_LAT,
    longitude: env.OFFICE_LNG,
    radiusMeters: env.OFFICE_RADIUS_METERS,
    poorAccuracyThresholdMeters: POOR_ACCURACY_THRESHOLD_METERS,
  };
}

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

  // ── Check-out guard ───────────────────────────────────────────────────────
  // Interns reported being checked out straight after checking in (a second tap
  // on the same button). A check-out needs a check-in first and must come at
  // least MIN_MINUTES_BEFORE_CHECKOUT after it.
  if (input.checkType === CheckType.CHECK_OUT) {
    const checkInToday = await Attendance.findOne({ intern: intern._id, date: today, checkType: CheckType.CHECK_IN });
    if (!checkInToday) throw createError('Check in first. You can check out at the end of the day.', 409);
    const minutes = (now.getTime() - new Date(checkInToday.submittedAt).getTime()) / 60_000;
    if (minutes < MIN_MINUTES_BEFORE_CHECKOUT) {
      throw createError(
        `You checked in ${Math.max(1, Math.round(minutes))} minute${Math.round(minutes) === 1 ? '' : 's'} ago. You can check out after ${MIN_MINUTES_BEFORE_CHECKOUT} minutes.`,
        409,
      );
    }
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

  // ── Face check and shared phone (check-in only) ───────────────────────────
  let face: CheckInFaceResult = { flagReasons: [] };
  let otherOnSamePhone: IAttendanceDocument[] = [];
  if (input.checkType === CheckType.CHECK_IN) {
    face = await evaluateCheckInFace(intern._id as mongoose.Types.ObjectId, input.face);
    flagReasons.push(...face.flagReasons);

    if (input.deviceId) {
      otherOnSamePhone = await Attendance.find({
        date: today,
        checkType: CheckType.CHECK_IN,
        deviceId: input.deviceId,
        intern: { $ne: intern._id },
      });
      if (otherOnSamePhone.length) flagReasons.push('SHARED_DEVICE');
    }
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

  const record = await Attendance.create({
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
    selfieKey: face.selfieKey,
    faceScore: face.faceScore,
    livenessPassed: face.livenessPassed,
    deviceId: input.deviceId,
  });

  // The earlier check-in from the same phone is just as suspect.
  for (const other of otherOnSamePhone) {
    const reasons = new Set(other.flagReasons ?? []);
    reasons.add('SHARED_DEVICE');
    other.flagReasons = [...reasons];
    if (other.status === AttendanceStatus.ACCEPTED) other.status = AttendanceStatus.FLAGGED;
    await other.save();
  }

  if (status === AttendanceStatus.FLAGGED) {
    notifyAllHR(
      NotificationType.ATTENDANCE_FLAGGED,
      'Flagged Attendance Check-in',
      `Attendance record for ${intern.firstName} ${intern.lastName} was flagged (${flagReasons.join(', ')}).`,
      { kind: 'Attendance', id: record._id.toString() },
    ).catch((err) => console.warn('[attendance.service] Failed to notify HR of flagged attendance:', err));
  }

  return record;
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listAttendance(
  query: ListAttendanceQuery,
): Promise<PaginatedResponse<IAttendanceDocument>> {
  const { page, limit, intern, status, checkType, date, from, to } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (intern && mongoose.isValidObjectId(intern)) {
    filter['intern'] = new mongoose.Types.ObjectId(intern);
  }
  if (status) filter['status'] = status;
  if (checkType) filter['checkType'] = checkType;

  if (date) {
    // If a specific date is requested (e.g. "2026-11-10"), match the start-of-day UTC
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      filter['date'] = toDateOnly(parsedDate);
    }
  } else if (from || to) {
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
