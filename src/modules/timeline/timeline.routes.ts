import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  handleGetTimeline,
  handleGetSummary,
  handleGetAdminHistory,
} from './timeline.controller';

const router = Router();

// ─── Intern timeline & summary ────────────────────────────────────────────────
// HR, Supervisor, and Intern can access — intern ownership enforced in controller.

router.get(
  '/interns/:id/timeline',
  authenticate,
  authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),
  handleGetTimeline,
);

router.get(
  '/interns/:id/summary',
  authenticate,
  authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),
  handleGetSummary,
);

// ─── Admin history ────────────────────────────────────────────────────────────
// HR only.

router.get(
  '/admin/history',
  authenticate,
  authorize(Role.HR),
  handleGetAdminHistory,
);

export default router;
