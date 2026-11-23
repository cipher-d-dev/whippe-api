import { listAttendanceSchema } from '../../src/modules/attendance/attendance.schema';
import { listTasksSchema } from '../../src/modules/tasks/task.schema';

// The staff portal asks for a whole day's attendance (300) and the task board
// (200) in one request. These were refused when the cap was 100.
describe('list limits used by the staff portal', () => {
  it('accepts the attendance page and interns list sizes', () => {
    expect(listAttendanceSchema.safeParse({ query: { date: '2026-11-23', limit: '300' } }).success).toBe(true);
    expect(listAttendanceSchema.safeParse({ query: { limit: '200', checkType: 'CHECK_IN' } }).success).toBe(true);
  });
  it('accepts the task board size', () => {
    expect(listTasksSchema.safeParse({ query: { limit: '200' } }).success).toBe(true);
  });
  it('still caps very large requests', () => {
    expect(listAttendanceSchema.safeParse({ query: { limit: '5000' } }).success).toBe(false);
  });
});

import { listInternsSchema } from '../../src/modules/interns/intern.schema';
it('accepts the dashboard active-interns size', () => {
  expect(listInternsSchema.safeParse({ query: { status: 'ACTIVE', limit: '200' } }).success).toBe(true);
});
