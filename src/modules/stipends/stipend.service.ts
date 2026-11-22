import mongoose from 'mongoose';
import { Intern } from '../interns/intern.model';
import { InternshipStatus, InternshipType } from '../interns/intern.types';
import { Attendance } from '../attendance/attendance.model';
import { AttendanceStatus, CheckType } from '../attendance/attendance.types';
import { getSettings, StipendRule } from '../settings/settings.service';
import { createError } from '../../middleware/error-handler';

/**
 * Stipend report: days worked per intern in a period, and a suggested amount.
 * HR and finance check it and decide what to pay; nothing is paid out here.
 *
 * - A day worked is a day with an ACCEPTED or CORRECTED check-in.
 *   FLAGGED days are listed separately; once HR corrects them they count.
 *   REJECTED days never count.
 * - Expected days come from Configuration (interns 20, corps members 16 a month).
 *   For a whole calendar month the intern was on the programme, that number is
 *   used as is. Otherwise it is pro-rated by weekdays, taking a standard month as
 *   20 weekdays (so corps members' 16 = 4 days a week).
 * - Suggested amount = full stipend × days worked ÷ expected days, never more
 *   than the full stipend, rounded to the nearest naira.
 */

const STANDARD_MONTH_WEEKDAYS = 20;
const DAY_MS = 86_400_000;

export interface StipendRow {
  internId: string;
  firstName: string;
  lastName: string;
  internshipType: InternshipType;
  department: string | null;
  supervisor: string | null;
  /** The part of the period the intern was on the programme (YYYY-MM-DD). */
  activeFrom: string;
  activeTo: string;
  expectedDays: number;
  daysWorked: number;
  flaggedDays: number;
  rejectedDays: number;
  fullAmount: number;
  suggestedAmount: number;
}

export interface StipendReport {
  period: { from: string; to: string; calendarMonth: boolean };
  rules: { INTERNSHIP: StipendRule; NYSC_IT: StipendRule };
  rows: StipendRow[];
  totals: { suggestedAmount: number; people: number };
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

export function parseDay(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw createError('Dates must look like 2026-11-30.', 400);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw createError(`${s} is not a real date.`, 400);
  return d;
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dayKey = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Monday–Friday days between two day keys, inclusive. */
export function countWeekdays(from: Date, to: Date): number {
  let n = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function isCalendarMonth(from: Date, to: Date): boolean {
  const last = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
  return from.getUTCDate() === 1 && to.getTime() === last.getTime();
}

/** Current calendar month in Lagos time (UTC+1). */
export function currentMonth(now = new Date()): { from: Date; to: Date } {
  const lagos = new Date(now.getTime() + 60 * 60_000);
  const from = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1));
  const to = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth() + 1, 0));
  return { from, to };
}

export function expectedDays(rule: StipendRule, period: { from: Date; to: Date }, active: { from: Date; to: Date }): number {
  const wholeMonth =
    isCalendarMonth(period.from, period.to) &&
    active.from.getTime() === period.from.getTime() &&
    active.to.getTime() === period.to.getTime();
  if (wholeMonth) return rule.days;
  return Math.round((rule.days * countWeekdays(active.from, active.to)) / STANDARD_MONTH_WEEKDAYS);
}

export function suggestedAmount(rule: StipendRule, worked: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.round((rule.amount * Math.min(worked, expected)) / expected);
}

type DayStatus = 'WORKED' | 'FLAGGED' | 'REJECTED';

/** One status per day: worked beats flagged beats rejected (a later correction wins). */
export function classifyDays(records: { date: Date; status: AttendanceStatus }[]) {
  const days = new Map<string, DayStatus>();
  const rank: Record<DayStatus, number> = { REJECTED: 0, FLAGGED: 1, WORKED: 2 };
  for (const r of records) {
    const s: DayStatus =
      r.status === AttendanceStatus.ACCEPTED || r.status === AttendanceStatus.CORRECTED
        ? 'WORKED'
        : r.status === AttendanceStatus.FLAGGED
          ? 'FLAGGED'
          : 'REJECTED';
    const key = isoDay(dayKey(new Date(r.date)));
    const prev = days.get(key);
    if (!prev || rank[s] > rank[prev]) days.set(key, s);
  }
  let worked = 0, flagged = 0, rejected = 0;
  for (const s of days.values()) {
    if (s === 'WORKED') worked++;
    else if (s === 'FLAGGED') flagged++;
    else rejected++;
  }
  return { worked, flagged, rejected };
}

// ─── Report ───────────────────────────────────────────────────────────────────

export async function getStipendReport(query: { from?: string; to?: string }, now = new Date()): Promise<StipendReport> {
  const month = currentMonth(now);
  const from = query.from ? parseDay(query.from) : month.from;
  const to = query.to ? parseDay(query.to) : query.from ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)) : month.to;
  if (to < from) throw createError('The end date is before the start date.', 400);
  if (to.getTime() - from.getTime() > 92 * DAY_MS) throw createError('Choose a period of three months or less.', 400);

  const settings = await getSettings();
  const rules = settings.stipend;

  const interns = await Intern.find({
    status: { $in: [InternshipStatus.ACTIVE, InternshipStatus.COMPLETED, InternshipStatus.ONBOARDING] },
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: new Date(to.getTime() + DAY_MS - 1) } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: from } }] },
    ],
  })
    .populate('department', 'name')
    .populate('supervisor', 'firstName lastName')
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const ids = interns.map((i) => i._id as mongoose.Types.ObjectId);
  const attendance = await Attendance.find({
    intern: { $in: ids },
    checkType: CheckType.CHECK_IN,
    date: { $gte: from, $lte: to },
  })
    .select('intern date status')
    .lean();

  const byIntern = new Map<string, { date: Date; status: AttendanceStatus }[]>();
  for (const a of attendance) {
    const k = String(a.intern);
    const list = byIntern.get(k) ?? [];
    list.push({ date: a.date, status: a.status as AttendanceStatus });
    byIntern.set(k, list);
  }

  const rows: StipendRow[] = interns.map((i) => {
    const type = i.internshipType as InternshipType;
    const rule = rules[type] ?? rules.INTERNSHIP;
    const activeFrom = i.startDate && dayKey(new Date(i.startDate)) > from ? dayKey(new Date(i.startDate)) : from;
    const activeTo = i.endDate && dayKey(new Date(i.endDate)) < to ? dayKey(new Date(i.endDate)) : to;
    const expected = expectedDays(rule, { from, to }, { from: activeFrom, to: activeTo });
    const { worked, flagged, rejected } = classifyDays(byIntern.get(String(i._id)) ?? []);
    const dept = i.department as unknown as { name?: string } | null;
    const sup = i.supervisor as unknown as { firstName?: string; lastName?: string } | null;
    return {
      internId: String(i._id),
      firstName: i.firstName,
      lastName: i.lastName,
      internshipType: type,
      department: dept?.name ?? null,
      supervisor: sup?.firstName ? `${sup.firstName} ${sup.lastName ?? ''}`.trim() : null,
      activeFrom: isoDay(activeFrom),
      activeTo: isoDay(activeTo),
      expectedDays: expected,
      daysWorked: worked,
      flaggedDays: flagged,
      rejectedDays: rejected,
      fullAmount: rule.amount,
      suggestedAmount: suggestedAmount(rule, worked, expected),
    };
  });

  return {
    period: { from: isoDay(from), to: isoDay(to), calendarMonth: isCalendarMonth(from, to) },
    rules,
    rows,
    totals: { suggestedAmount: rows.reduce((s, r) => s + r.suggestedAmount, 0), people: rows.length },
  };
}
