import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../../middleware/auth';
import { listNotificationsSchema } from './notification.schema';
import {
  listNotifications,
  markOneRead,
  markAllRead,
} from './notification.service';

// ─── GET /api/v1/notifications ────────────────────────────────────────────────

export async function handleListNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: userId } = getAuthUser(req);
    const query = listNotificationsSchema.parse(req.query);
    const result = await listNotifications(query, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/notifications/:id/read ─────────────────────────────────────

export async function handleMarkOneRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: userId } = getAuthUser(req);
    const notification = await markOneRead(req.params.id, userId);

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/notifications/read-all ─────────────────────────────────────

export async function handleMarkAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: userId } = getAuthUser(req);
    const { count } = await markAllRead(userId);

    res.status(200).json({
      success: true,
      message: `${count} notification${count !== 1 ? 's' : ''} marked as read.`,
      count,
    });
  } catch (err) {
    next(err);
  }
}
