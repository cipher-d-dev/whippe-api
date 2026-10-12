import mongoose from 'mongoose';

// ─── Mock the Notification model before importing the service ─────────────────
jest.mock('../../src/modules/notifications/notification.model', () => ({
  Notification: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

import { Notification } from '../../src/modules/notifications/notification.model';
import {
  createNotification,
  listNotifications,
  markOneRead,
  markAllRead,
} from '../../src/modules/notifications/notification.service';
import { NotificationType } from '../../src/modules/notifications/notification.types';

const recipientId = new mongoose.Types.ObjectId().toString();
const notificationId = new mongoose.Types.ObjectId().toString();

const mockNotification = {
  _id: new mongoose.Types.ObjectId(),
  recipient: new mongoose.Types.ObjectId(recipientId),
  type: NotificationType.ACCOUNT_APPROVED,
  title: 'Account approved',
  body: 'Your account has been approved.',
  read: false,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createNotification ────────────────────────────────────────────────────────

describe('createNotification', () => {
  it('creates a notification with required fields', async () => {
    (Notification.create as jest.Mock).mockResolvedValue(mockNotification);

    const result = await createNotification(
      recipientId,
      NotificationType.ACCOUNT_APPROVED,
      'Account approved',
      'Your account has been approved.',
    );

    expect(Notification.create).toHaveBeenCalledTimes(1);
    const callArg = (Notification.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg['type']).toBe(NotificationType.ACCOUNT_APPROVED);
    expect(callArg['title']).toBe('Account approved');
    expect(callArg['body']).toBe('Your account has been approved.');
    expect(result).toEqual(mockNotification);
  });

  it('includes relatedEntity when provided', async () => {
    (Notification.create as jest.Mock).mockResolvedValue(mockNotification);
    const entityId = new mongoose.Types.ObjectId().toString();

    await createNotification(
      recipientId,
      NotificationType.TASK_ASSIGNED,
      'New task',
      'A task was assigned.',
      { kind: 'Task', id: entityId },
    );

    const callArg = (Notification.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg['relatedEntity']).toBeDefined();
    const related = callArg['relatedEntity'] as { kind: string };
    expect(related.kind).toBe('Task');
  });
});

// ─── listNotifications ────────────────────────────────────────────────────────

describe('listNotifications', () => {
  it('returns paginated notifications for the user', async () => {
    (Notification.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockNotification]),
    });
    (Notification.countDocuments as jest.Mock).mockResolvedValue(1);

    const result = await listNotifications({ page: 1, limit: 20, read: undefined }, recipientId);

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('filters by read state when provided', async () => {
    (Notification.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    (Notification.countDocuments as jest.Mock).mockResolvedValue(0);

    await listNotifications({ page: 1, limit: 20, read: false }, recipientId);

    const filterArg = (Notification.find as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(filterArg['read']).toBe(false);
  });
});

// ─── markOneRead ──────────────────────────────────────────────────────────────

describe('markOneRead', () => {
  it('updates the notification to read=true', async () => {
    const updated = { ...mockNotification, read: true };
    (Notification.findOneAndUpdate as jest.Mock).mockResolvedValue(updated);

    const result = await markOneRead(notificationId, recipientId);

    expect(Notification.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(result.read).toBe(true);
  });

  it('throws 404 when notification not found or not owned by user', async () => {
    (Notification.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await expect(markOneRead(notificationId, recipientId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 for an invalid notification ID', async () => {
    await expect(markOneRead('not-an-id', recipientId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────────

describe('markAllRead', () => {
  it('returns the count of updated notifications', async () => {
    (Notification.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 5 });

    const result = await markAllRead(recipientId);

    expect(result.count).toBe(5);
    expect(Notification.updateMany).toHaveBeenCalledTimes(1);
  });

  it('returns count=0 when no unread notifications exist', async () => {
    (Notification.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 0 });

    const result = await markAllRead(recipientId);

    expect(result.count).toBe(0);
  });
});
