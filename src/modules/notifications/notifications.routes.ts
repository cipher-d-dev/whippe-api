import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  handleListNotifications,
  handleMarkOneRead,
  handleMarkAllRead,
} from './notification.controller';
import {
  handleGetVapidKey,
  handleSubscribe,
  handleUnsubscribe,
} from './push.controller';

const router = Router();

// ─── Push subscription (auth optional for VAPID key, required for sub/unsub) ─

// Public — the browser needs this to subscribe before the user is necessarily logged in
router.get('/vapid-public-key', handleGetVapidKey);

// Authenticated push subscription management
router.post('/subscribe',   authenticate, handleSubscribe);
router.delete('/subscribe', authenticate, handleUnsubscribe);

// ─── Notification reads ───────────────────────────────────────────────────────

// All notification routes require authentication.
// Users see only their own notifications — enforced in the service layer.

// GET  /api/v1/notifications          — paginated list for the authenticated user
router.get('/', authenticate, handleListNotifications);

// PATCH /api/v1/notifications/read-all — mark all as read
// Must be registered before /:id/read so Express does not treat "read-all" as an :id param
router.patch('/read-all', authenticate, handleMarkAllRead);

// PATCH /api/v1/notifications/:id/read — mark one as read
router.patch('/:id/read', authenticate, handleMarkOneRead);

export default router;
