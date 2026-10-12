import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  handleListNotifications,
  handleMarkOneRead,
  handleMarkAllRead,
} from './notification.controller';

const router = Router();

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
