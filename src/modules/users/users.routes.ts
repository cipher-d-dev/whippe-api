import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  getVerificationQueueHandler,
  listUsersHandler,
  getUserByIdHandler,
  approveUserHandler,
  rejectUserHandler,
} from './users.controller';

const router = Router();

// All users routes require authentication
router.use(authenticate);

// ─── HR only ──────────────────────────────────────────────────────────────────

// GET /api/v1/users/verification-queue
// Must be declared before /:userId to avoid route conflict
router.get(
  '/verification-queue',
  authorize(Role.HR),
  getVerificationQueueHandler,
);

// GET /api/v1/users
router.get('/', authorize(Role.HR), listUsersHandler);

// PATCH /api/v1/users/:userId/approve
router.patch('/:userId/approve', authorize(Role.HR), approveUserHandler);

// PATCH /api/v1/users/:userId/reject
router.patch('/:userId/reject', authorize(Role.HR), rejectUserHandler);

// ─── Any authenticated user ────────────────────────────────────────────────────
// HR: any user by ID. Intern/Supervisor: redirected to own profile in controller.

// GET /api/v1/users/:userId
router.get('/:userId', getUserByIdHandler);

export default router;
