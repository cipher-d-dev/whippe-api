import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import { getSettingsHandler, updateSettingsHandler } from './settings.controller';

const router = Router();

// GET /api/v1/settings — public: wording only, used on sign-in and sign-up screens too.
router.get('/', getSettingsHandler);

// PATCH /api/v1/settings — HR only.
router.patch('/', authenticate, authorize(Role.HR), updateSettingsHandler);

export default router;
