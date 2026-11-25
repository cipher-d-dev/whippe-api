import { isLateCheckIn } from '../../src/modules/attendance/attendance.service';

// Lagos is UTC+1, so 10:00 Lagos is 09:00Z.
describe('isLateCheckIn', () => {
  it('10:00 (and its seconds) is on time, 10:01 is late', () => {
    expect(isLateCheckIn(new Date('2026-11-25T08:59:00Z'), '10:00')).toBe(false);
    expect(isLateCheckIn(new Date('2026-11-25T09:00:59Z'), '10:00')).toBe(false);
    expect(isLateCheckIn(new Date('2026-11-25T09:01:00Z'), '10:00')).toBe(true);
    expect(isLateCheckIn(new Date('2026-11-25T15:30:00Z'), '10:00')).toBe(true);
  });
  it('follows the configured time', () => {
    expect(isLateCheckIn(new Date('2026-11-25T08:31:00Z'), '09:30')).toBe(true);
    expect(isLateCheckIn(new Date('2026-11-25T08:31:00Z'), '10:00')).toBe(false);
  });
});
