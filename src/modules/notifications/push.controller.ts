import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { savePushSubscription, removePushSubscription, getVapidPublicKey } from './push.service';
import { createError } from '../../middleware/error-handler';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key required'),
    auth:   z.string().min(1, 'auth key required'),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL'),
});

// ─── GET /api/v1/notifications/vapid-public-key ───────────────────────────────

export async function handleGetVapidKey(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const key = getVapidPublicKey();
    if (!key) {
      res.status(503).json({ success: false, message: 'Push notifications not configured.' });
      return;
    }
    res.json({ success: true, data: { vapidPublicKey: key } });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/notifications/subscribe ────────────────────────────────────

export async function handleSubscribe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message ?? 'Invalid subscription', 400);
    }

    const userId = (req.user as { id: string }).id;
    await savePushSubscription(userId, parsed.data);

    res.status(201).json({ success: true, message: 'Push subscription saved.' });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/v1/notifications/subscribe ──────────────────────────────────

export async function handleUnsubscribe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError('endpoint is required', 400);
    }

    const userId = (req.user as { id: string }).id;
    await removePushSubscription(userId, parsed.data.endpoint);

    res.json({ success: true, message: 'Push subscription removed.' });
  } catch (err) {
    next(err);
  }
}
