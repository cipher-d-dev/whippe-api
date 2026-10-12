import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import { handleGetExitChecklist, handleCompleteInternship } from './exit.controller';

const router = Router();

// GET  /api/v1/interns/:id/exit-checklist — HR views outstanding items before closing
router.get(
  '/:id/exit-checklist',
  authenticate,
  authorize(Role.HR),
  handleGetExitChecklist,
);

// POST /api/v1/interns/:id/complete — HR closes the internship
router.post(
  '/:id/complete',
  authenticate,
  authorize(Role.HR),
  handleCompleteInternship,
);

export default router;
