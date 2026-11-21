import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import { getDashboardHandler } from './dashboard.controller';

const router = Router();

// GET /api/v1/admin/dashboard — HR only. All HR dashboard figures in one call.
router.get('/', authenticate, authorize(Role.HR), getDashboardHandler);

export default router;
