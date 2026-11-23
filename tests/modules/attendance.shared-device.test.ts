jest.mock('../../src/modules/interns/intern.model', () => ({ Intern: { findOne: jest.fn() } }));
jest.mock('../../src/modules/attendance/attendance.model', () => ({
  Attendance: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(async (d: unknown) => ({ ...(d as object), _id: 'new' })) },
}));
jest.mock('../../src/modules/face/face.service', () => ({ evaluateCheckInFace: jest.fn(async () => ({ flagReasons: [] })) }));
jest.mock('../../src/modules/notifications/notification.service', () => ({ notifyAllHR: jest.fn(async () => undefined) }));

import mongoose from 'mongoose';
import { Intern } from '../../src/modules/interns/intern.model';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { checkIn } from '../../src/modules/attendance/attendance.service';
import { AttendanceStatus, CheckType } from '../../src/modules/attendance/attendance.types';

const office = { latitude: 6.4281, longitude: 3.4219, locationAccuracy: 10 };

describe('one phone, two interns', () => {
  it('flags both check-ins when a phone already checked someone else in today', async () => {
    (Intern.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), firstName: 'A', lastName: 'B' });
    (Attendance.findOne as jest.Mock).mockResolvedValue(null);
    const earlier = { status: AttendanceStatus.ACCEPTED, flagReasons: [] as string[], save: jest.fn() };
    (Attendance.find as jest.Mock).mockResolvedValue([earlier]);

    await checkIn('u1', { checkType: CheckType.CHECK_IN, ...office, deviceId: 'phone-123456' }, '1.1.1.1', 'ua');

    const created = (Attendance.create as jest.Mock).mock.calls[0][0];
    expect(created.status).toBe(AttendanceStatus.FLAGGED);
    expect(created.flagReasons).toContain('SHARED_DEVICE');
    expect(earlier.status).toBe(AttendanceStatus.FLAGGED);
    expect(earlier.flagReasons).toContain('SHARED_DEVICE');
    expect(earlier.save).toHaveBeenCalled();
  });

  it('leaves a normal check-in alone', async () => {
    (Intern.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), firstName: 'A', lastName: 'B' });
    (Attendance.findOne as jest.Mock).mockResolvedValue(null);
    (Attendance.find as jest.Mock).mockResolvedValue([]);
    await checkIn('u1', { checkType: CheckType.CHECK_IN, ...office, deviceId: 'phone-abcdefgh' }, '1.1.1.1', 'ua');
    expect((Attendance.create as jest.Mock).mock.calls[0][0].status).toBe(AttendanceStatus.ACCEPTED);
  });
});

describe('check-out guard', () => {
  const internId = new mongoose.Types.ObjectId();
  beforeEach(() => {
    (Intern.findOne as jest.Mock).mockResolvedValue({ _id: internId, firstName: 'A', lastName: 'B' });
  });

  it('treats a check-out seconds after checking in as a double tap', async () => {
    (Attendance.findOne as jest.Mock)
      .mockResolvedValueOnce(null) // no duplicate check-out
      .mockResolvedValueOnce({ submittedAt: new Date(Date.now() - 10_000) }); // checked in 10 s ago
    await expect(checkIn('u1', { checkType: CheckType.CHECK_OUT, ...office }, 'ip', 'ua')).rejects.toMatchObject({ statusCode: 409 });
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  it('refuses a check-out with no check-in', async () => {
    (Attendance.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(checkIn('u1', { checkType: CheckType.CHECK_OUT, ...office }, 'ip', 'ua')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows leaving early, e.g. 10 minutes after checking in', async () => {
    (Attendance.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ submittedAt: new Date(Date.now() - 10 * 60_000) });
    (Attendance.find as jest.Mock).mockResolvedValue([]);
    await checkIn('u1', { checkType: CheckType.CHECK_OUT, ...office }, 'ip', 'ua');
    expect((Attendance.create as jest.Mock).mock.calls[0][0].checkType).toBe(CheckType.CHECK_OUT);
  });
});
