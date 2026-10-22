import mongoose from 'mongoose';
import { Notification, INotificationDocument } from './notification.model';
import { NotificationType } from './notification.types';
import { createError } from '../../middleware/error-handler';
import { ListNotificationsQuery } from './notification.schema';
import { PaginatedResponse } from '../users/user.types';
import { sendPushToUser } from './push.service';

// ─── createNotification ───────────────────────────────────────────────────────
// Internal utility called by other services — never called directly by clients.

export async function createNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  relatedEntity?: { kind: string; id: string },
): Promise<INotificationDocument> {
  const doc: Record<string, unknown> = {
    recipient: new mongoose.Types.ObjectId(recipientId),
    type,
    title,
    body,
  };

  if (relatedEntity) {
    doc.relatedEntity = {
      kind: relatedEntity.kind,
      id: new mongoose.Types.ObjectId(relatedEntity.id),
    };
  }

  const notification = await Notification.create(doc);

  // Fire-and-forget push — do not let push failure affect the DB write
  sendPushToUser(recipientId, { title, body }).catch((err) => {
    console.warn('[push] sendPushToUser error:', err);
  });

  return notification;
}

// ─── List notifications for the authenticated user ────────────────────────────

export async function listNotifications(
  query: ListNotificationsQuery,
  userId: string,
): Promise<PaginatedResponse<INotificationDocument>> {
  const { page, limit, read } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    recipient: new mongoose.Types.ObjectId(userId),
  };

  if (read !== undefined) {
    filter['read'] = read;
  }

  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Mark one notification as read ───────────────────────────────────────────

export async function markOneRead(
  notificationId: string,
  userId: string,
): Promise<INotificationDocument> {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw createError('Invalid notification ID.', 400);
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      recipient: new mongoose.Types.ObjectId(userId),
    },
    { read: true },
    { new: true },
  );

  if (!notification) {
    throw createError('Notification not found.', 404);
  }

  return notification;
}

// ─── Mark all notifications as read ──────────────────────────────────────────

export async function markAllRead(userId: string): Promise<{ count: number }> {
  const result = await Notification.updateMany(
    {
      recipient: new mongoose.Types.ObjectId(userId),
      read: false,
    },
    { read: true },
  );

  return { count: result.modifiedCount };
}
