import mongoose from 'mongoose';
import { Intern } from '../interns/intern.model';
import { InternshipStatus, InternshipType } from '../interns/intern.types';
import { Attendance } from '../attendance/attendance.model';
import { AttendanceStatus, CheckType } from '../attendance/attendance.types';
import { User } from '../users/user.model';
import { AccountStatus } from '../auth/auth.types';
import { DocumentRecord } from '../documents/document.model';
import { DocumentStatus } from '../documents/document.types';
import { Task } from '../tasks/task.model';
import { Report } from '../reports/report.model';
import { ReportStatus, TaskStatus } from '../tasks/task.types';
import { Evaluation } from '../evaluations/evaluation.model';
import { EvaluationStatus } from '../evaluations/evaluation.types';

// ─── Shape ────────────────────────────────────────────────────────────────────
// Everything the HR dashboard shows, in one response, so the web app no longer
// needs a dozen list calls to assemble it.

export interface DashboardStats {
  generatedAt: string;
  interns: {
    total: number;
    byStatus: Record<InternshipStatus, number>;
    activeByType: Record<InternshipType, number>;
    /** Active interns grouped by their department's subsidiary, largest first. */
    activeBySubsidiary: { subsidiary: string; count: number }[];
  };
  today: {
    date: string; // YYYY-MM-DD, same day key attendance uses
    /** Active interns with a check-in that counts as present (accepted, flagged or corrected). */
    checkedIn: number;
    accepted: number;
    flagged: number;
    rejected: number;
    corrected: number;
    /** Active interns with no check-in attempt today. */
    notCheckedIn: number;
    /** Mean check-in time of present interns, Lagos time, "HH:mm"; null if nobody yet. */
    averageArrival: string | null;
  };
  /** Monday to Friday of the current week; checkedIn is null for days still to come. */
  week: { date: string; weekday: string; checkedIn: number | null }[];
  pending: {
    verifications: number;
    documentsToVerify: number;
    tasksToReview: number;
    reportsToReview: number;
    draftEvaluations: number;
  };
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Statuses that mean the intern was at the office. Rejected check-ins don't count. */
export const PRESENT_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.ACCEPTED,
  AttendanceStatus.FLAGGED,
  AttendanceStatus.CORRECTED,
];

// Nigeria (Africa/Lagos) is UTC+1 all year, with no daylight saving.
const LAGOS_UTC_OFFSET_MINUTES = 60;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** UTC midnight of the given instant — the per-day key attendance records use. */
export function toDayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday to Friday (as day keys) of the week that contains `now`. Weeks start on Monday. */
export function workWeek(now: Date): Date[] {
  const today = toDayKey(now);
  const sinceMonday = (today.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(today.getTime() - sinceMonday * 86_400_000);
  return WEEKDAYS.map((_, i) => new Date(monday.getTime() + i * 86_400_000));
}

/** Minutes after midnight, Lagos time. */
export function lagosMinutesOfDay(d: Date): number {
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMinutes + LAGOS_UTC_OFFSET_MINUTES) % 1440;
}

export function formatClock(minutes: number): string {
  const m = Math.round(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface CheckInRow {
  intern: mongoose.Types.ObjectId | string;
  date: Date;
  status: AttendanceStatus;
  submittedAt: Date;
}

/**
 * Turns this week's CHECK_IN records into the dashboard's "today" and "week" figures.
 * Each intern counts once per day, whatever the number of records.
 */
export function summariseCheckIns(
  rows: CheckInRow[],
  now: Date,
  activeInterns: number,
): { today: DashboardStats['today']; week: DashboardStats['week'] } {
  const todayKey = isoDay(toDayKey(now));
  const presentByDay = new Map<string, Set<string>>();
  const attemptedToday = new Set<string>();
  const statusToday: Record<AttendanceStatus, number> = {
    [AttendanceStatus.ACCEPTED]: 0,
    [AttendanceStatus.FLAGGED]: 0,
    [AttendanceStatus.REJECTED]: 0,
    [AttendanceStatus.CORRECTED]: 0,
  };
  const arrivalMinutes: number[] = [];

  for (const row of rows) {
    const day = isoDay(toDayKey(new Date(row.date)));
    const intern = String(row.intern);
    const present = PRESENT_STATUSES.includes(row.status);

    if (present) {
      if (!presentByDay.has(day)) presentByDay.set(day, new Set());
      presentByDay.get(day)!.add(intern);
    }

    if (day === todayKey) {
      attemptedToday.add(intern);
      statusToday[row.status] += 1;
      if (present) arrivalMinutes.push(lagosMinutesOfDay(new Date(row.submittedAt)));
    }
  }

  const averageArrival = arrivalMinutes.length
    ? formatClock(arrivalMinutes.reduce((a, b) => a + b, 0) / arrivalMinutes.length)
    : null;

  const week = workWeek(now).map((d, i) => {
    const key = isoDay(d);
    return {
      date: key,
      weekday: WEEKDAYS[i],
      checkedIn: key > todayKey ? null : (presentByDay.get(key)?.size ?? 0),
    };
  });

  return {
    today: {
      date: todayKey,
      checkedIn: presentByDay.get(todayKey)?.size ?? 0,
      accepted: statusToday[AttendanceStatus.ACCEPTED],
      flagged: statusToday[AttendanceStatus.FLAGGED],
      rejected: statusToday[AttendanceStatus.REJECTED],
      corrected: statusToday[AttendanceStatus.CORRECTED],
      notCheckedIn: Math.max(0, activeInterns - attemptedToday.size),
      averageArrival,
    },
    week,
  };
}

function zeroed<E extends string>(values: E[]): Record<E, number> {
  return Object.fromEntries(values.map((v) => [v, 0])) as Record<E, number>;
}

// ─── getDashboardStats ────────────────────────────────────────────────────────

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const days = workWeek(now);

  const [
    statusGroups,
    typeGroups,
    subsidiaryGroups,
    checkIns,
    verifications,
    documentsToVerify,
    tasksToReview,
    reportsToReview,
    draftEvaluations,
  ] = await Promise.all([
    Intern.aggregate<{ _id: InternshipStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Intern.aggregate<{ _id: InternshipType; count: number }>([
      { $match: { status: InternshipStatus.ACTIVE } },
      { $group: { _id: '$internshipType', count: { $sum: 1 } } },
    ]),
    Intern.aggregate<{ _id: string | null; count: number }>([
      { $match: { status: InternshipStatus.ACTIVE } },
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
      { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$dept.subsidiary', 0] }, null] }, count: { $sum: 1 } } },
    ]),
    Attendance.find({
      checkType: CheckType.CHECK_IN,
      date: { $gte: days[0], $lte: days[days.length - 1] },
    })
      .select('intern date status submittedAt')
      .lean<CheckInRow[]>(),
    User.countDocuments({ status: AccountStatus.PENDING_HR_VERIFICATION }),
    DocumentRecord.countDocuments({
      status: { $in: [DocumentStatus.DIGITAL_RECEIVED, DocumentStatus.PHYSICAL_RECEIVED] },
    }),
    Task.countDocuments({ status: TaskStatus.SUBMITTED }),
    Report.countDocuments({ status: ReportStatus.SUBMITTED }),
    Evaluation.countDocuments({ status: EvaluationStatus.DRAFT }),
  ]);

  const byStatus = zeroed(Object.values(InternshipStatus));
  for (const g of statusGroups) if (g._id in byStatus) byStatus[g._id] = g.count;

  const activeByType = zeroed(Object.values(InternshipType));
  for (const g of typeGroups) if (g._id in activeByType) activeByType[g._id] = g.count;

  const activeBySubsidiary = subsidiaryGroups
    .map((g) => ({ subsidiary: g._id?.trim() || 'Unassigned', count: g.count }))
    .sort((a, b) => b.count - a.count);

  const { today, week } = summariseCheckIns(checkIns, now, byStatus[InternshipStatus.ACTIVE]);

  return {
    generatedAt: now.toISOString(),
    interns: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      activeByType,
      activeBySubsidiary,
    },
    today,
    week,
    pending: { verifications, documentsToVerify, tasksToReview, reportsToReview, draftEvaluations },
  };
}
