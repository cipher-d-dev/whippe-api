import mongoose from 'mongoose';

// ─── Mock every model the dashboard reads ─────────────────────────────────────
jest.mock('../../src/modules/interns/intern.model', () => ({ Intern: { aggregate: jest.fn() } }));
jest.mock('../../src/modules/attendance/attendance.model', () => ({ Attendance: { find: jest.fn() } }));
jest.mock('../../src/modules/users/user.model', () => ({ User: { countDocuments: jest.fn() } }));
jest.mock('../../src/modules/documents/document.model', () => ({ DocumentRecord: { countDocuments: jest.fn() } }));
jest.mock('../../src/modules/tasks/task.model', () => ({ Task: { countDocuments: jest.fn() } }));
jest.mock('../../src/modules/reports/report.model', () => ({ Report: { countDocuments: jest.fn() } }));
jest.mock('../../src/modules/evaluations/evaluation.model', () => ({ Evaluation: { countDocuments: jest.fn() } }));

import { Intern } from '../../src/modules/interns/intern.model';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { User } from '../../src/modules/users/user.model';
import { DocumentRecord } from '../../src/modules/documents/document.model';
import { Task } from '../../src/modules/tasks/task.model';
import { Report } from '../../src/modules/reports/report.model';
import { Evaluation } from '../../src/modules/evaluations/evaluation.model';
import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import {
  workWeek,
  isoDay,
  lagosMinutesOfDay,
  formatClock,
  summariseCheckIns,
  getDashboardStats,
  CheckInRow,
} from '../../src/modules/dashboard/dashboard.service';

// Saturday 21 Nov 2026 — a weekend day still belongs to the Mon 16 – Fri 20 work week.
const NOW = new Date('2026-11-21T10:30:00Z');
const a = new mongoose.Types.ObjectId();
const b = new mongoose.Types.ObjectId();
const c = new mongoose.Types.ObjectId();

const row = (intern: mongoose.Types.ObjectId, day: string, status: AttendanceStatus, utcTime = '07:00'): CheckInRow => ({
  intern,
  date: new Date(`${day}T00:00:00Z`),
  status,
  submittedAt: new Date(`${day}T${utcTime}:00Z`),
});

describe('workWeek', () => {
  it('returns Monday to Friday of the week containing the date', () => {
    expect(workWeek(NOW).map(isoDay)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  });

  it('treats Sunday as the end of the same week, not the start of the next', () => {
    expect(isoDay(workWeek(new Date('2026-11-22T12:00:00Z'))[0])).toBe('2026-11-16');
  });

  it('starts a new week on Monday', () => {
    expect(isoDay(workWeek(new Date('2026-11-23T08:00:00Z'))[0])).toBe('2026-11-23');
  });
});

describe('lagos time helpers', () => {
  it('shifts UTC to Lagos (UTC+1)', () => {
    expect(lagosMinutesOfDay(new Date('2026-11-20T07:12:00Z'))).toBe(8 * 60 + 12);
  });

  it('wraps past midnight', () => {
    expect(lagosMinutesOfDay(new Date('2026-11-20T23:30:00Z'))).toBe(30);
  });

  it('formats minutes as a zero-padded clock', () => {
    expect(formatClock(8 * 60 + 7)).toBe('08:07');
    expect(formatClock(497.6)).toBe('08:18');
  });
});

describe('summariseCheckIns', () => {
  const THU = new Date('2026-11-19T10:30:00Z'); // Thursday

  it('counts each intern once per day and ignores rejected check-ins as present', () => {
    const rows = [
      row(a, '2026-11-19', AttendanceStatus.ACCEPTED, '07:00'),
      row(a, '2026-11-19', AttendanceStatus.ACCEPTED, '07:05'), // duplicate record, same intern
      row(b, '2026-11-19', AttendanceStatus.FLAGGED, '08:00'),
      row(c, '2026-11-19', AttendanceStatus.REJECTED, '07:30'),
      row(a, '2026-11-18', AttendanceStatus.ACCEPTED),
      row(b, '2026-11-18', AttendanceStatus.CORRECTED),
    ];
    const { today, week } = summariseCheckIns(rows, THU, 10);

    expect(today.date).toBe('2026-11-19');
    expect(today.checkedIn).toBe(2);
    expect(today.accepted).toBe(2);
    expect(today.flagged).toBe(1);
    expect(today.rejected).toBe(1);
    expect(today.notCheckedIn).toBe(7); // 10 active − 3 who tried
    expect(week.find((d) => d.date === '2026-11-18')?.checkedIn).toBe(2);
    expect(week.find((d) => d.date === '2026-11-19')?.checkedIn).toBe(2);
  });

  it('averages arrival over present check-ins only, in Lagos time', () => {
    const rows = [
      row(a, '2026-11-19', AttendanceStatus.ACCEPTED, '07:00'), // 08:00 Lagos
      row(b, '2026-11-19', AttendanceStatus.ACCEPTED, '07:30'), // 08:30 Lagos
      row(c, '2026-11-19', AttendanceStatus.REJECTED, '11:00'), // ignored
    ];
    expect(summariseCheckIns(rows, THU, 3).today.averageArrival).toBe('08:15');
  });

  it('returns null arrival and marks future weekdays as null', () => {
    const { today, week } = summariseCheckIns([], THU, 5);
    expect(today.averageArrival).toBeNull();
    expect(today.notCheckedIn).toBe(5);
    expect(week.map((d) => d.checkedIn)).toEqual([0, 0, 0, 0, null]);
    expect(week.map((d) => d.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });
});

describe('getDashboardStats', () => {
  beforeEach(() => {
    (Intern.aggregate as jest.Mock)
      .mockResolvedValueOnce([{ _id: 'ACTIVE', count: 3 }, { _id: 'ONBOARDING', count: 2 }, { _id: 'COMPLETED', count: 1 }])
      .mockResolvedValueOnce([{ _id: 'INTERNSHIP', count: 2 }, { _id: 'NYSC_IT', count: 1 }])
      .mockResolvedValueOnce([{ _id: 'Raypower', count: 1 }, { _id: 'AIT', count: 2 }, { _id: null, count: 0 }]);
    (Attendance.find as jest.Mock).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([row(a, '2026-11-19', AttendanceStatus.ACCEPTED)]) }),
    });
    (User.countDocuments as jest.Mock).mockResolvedValue(6);
    (DocumentRecord.countDocuments as jest.Mock).mockResolvedValue(4);
    (Task.countDocuments as jest.Mock).mockResolvedValue(23);
    (Report.countDocuments as jest.Mock).mockResolvedValue(12);
    (Evaluation.countDocuments as jest.Mock).mockResolvedValue(2);
  });

  it('assembles every dashboard figure into one object', async () => {
    const stats = await getDashboardStats(new Date('2026-11-19T10:30:00Z'));

    expect(stats.interns.total).toBe(6);
    expect(stats.interns.byStatus).toEqual({ SCREENED: 0, ONBOARDING: 2, ACTIVE: 3, COMPLETED: 1 });
    expect(stats.interns.activeByType).toEqual({ INTERNSHIP: 2, NYSC_IT: 1 });
    expect(stats.interns.activeBySubsidiary).toEqual([
      { subsidiary: 'AIT', count: 2 },
      { subsidiary: 'Raypower', count: 1 },
      { subsidiary: 'Unassigned', count: 0 },
    ]);
    expect(stats.today.checkedIn).toBe(1);
    expect(stats.today.notCheckedIn).toBe(2);
    expect(stats.pending).toEqual({
      verifications: 6, documentsToVerify: 4, tasksToReview: 23, reportsToReview: 12, draftEvaluations: 2,
    });
  });

  it('only reads check-ins for the current Monday–Friday', async () => {
    await getDashboardStats(new Date('2026-11-19T10:30:00Z'));
    const filter = (Attendance.find as jest.Mock).mock.calls[0][0];
    expect(filter.checkType).toBe('CHECK_IN');
    expect(isoDay(filter.date.$gte)).toBe('2026-11-16');
    expect(isoDay(filter.date.$lte)).toBe('2026-11-20');
  });
});
