import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import {
  classifyDays, countWeekdays, currentMonth, expectedDays, isCalendarMonth, parseDay, suggestedAmount,
} from '../../src/modules/stipends/stipend.service';

const intern = { days: 20, amount: 40_000 };
const corps = { days: 16, amount: 50_000 };
const d = parseDay;

describe('stipend helpers', () => {
  it('counts weekdays only', () => {
    expect(countWeekdays(d('2026-11-02'), d('2026-11-08'))).toBe(5); // Mon–Sun
    expect(countWeekdays(d('2026-11-01'), d('2026-11-30'))).toBe(21);
  });

  it('knows a whole calendar month', () => {
    expect(isCalendarMonth(d('2026-11-01'), d('2026-11-30'))).toBe(true);
    expect(isCalendarMonth(d('2026-11-01'), d('2026-11-29'))).toBe(false);
    expect(isCalendarMonth(d('2026-02-01'), d('2026-02-28'))).toBe(true);
  });

  it('uses the monthly figure for a whole month on the programme', () => {
    const month = { from: d('2026-11-01'), to: d('2026-11-30') };
    expect(expectedDays(intern, month, month)).toBe(20);
    expect(expectedDays(corps, month, month)).toBe(16);
  });

  it('pro-rates by weekdays for part of a month (corps = 4 days a week)', () => {
    const month = { from: d('2026-11-01'), to: d('2026-11-30') };
    const lastTwoWeeks = { from: d('2026-11-16'), to: d('2026-11-30') }; // 11 weekdays
    expect(expectedDays(intern, month, lastTwoWeeks)).toBe(11);
    expect(expectedDays(corps, month, lastTwoWeeks)).toBe(9); // 16 × 11 / 20 = 8.8
  });

  it('suggests a pro-rata amount, never above the full stipend', () => {
    expect(suggestedAmount(corps, 14, 16)).toBe(43_750);
    expect(suggestedAmount(intern, 20, 20)).toBe(40_000);
    expect(suggestedAmount(intern, 23, 20)).toBe(40_000);
    expect(suggestedAmount(intern, 0, 0)).toBe(0);
  });

  it('counts accepted and corrected days, lists flagged separately, ignores rejected', () => {
    const at = (day: string, status: AttendanceStatus) => ({ date: d(day), status });
    const out = classifyDays([
      at('2026-11-02', AttendanceStatus.ACCEPTED),
      at('2026-11-03', AttendanceStatus.CORRECTED),
      at('2026-11-04', AttendanceStatus.FLAGGED),
      at('2026-11-05', AttendanceStatus.REJECTED),
      at('2026-11-05', AttendanceStatus.CORRECTED), // HR corrected the rejected day
    ]);
    expect(out).toEqual({ worked: 3, flagged: 1, rejected: 0 });
  });

  it('defaults to the current month in Lagos time', () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Lagos
    const m = currentMonth(new Date('2026-11-30T23:30:00Z'));
    expect(m.from.toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(m.to.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('rejects malformed dates', () => {
    expect(() => parseDay('30/11/2026')).toThrow();
  });
});
