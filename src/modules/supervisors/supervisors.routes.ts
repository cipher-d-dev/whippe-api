import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createSupervisorHandler,
  listSupervisorsHandler,
  getMySupervisorProfileHandler,
  getSupervisorByIdHandler,
  updateSupervisorHandler,
  getSupervisorInternsHandler,
} from './supervisor.controller';

const router = Router();

router.use(authenticate);

// GET /api/v1/supervisors/me — supervisor gets own profile
router.get('/me', authorize(Role.SUPERVISOR), getMySupervisorProfileHandler);

// HR only — create, list all
router.post('/', authorize(Role.HR), createSupervisorHandler);
router.get('/', authorize(Role.HR), listSupervisorsHandler);

// HR or Supervisor (ownership enforced in controller)
router.get('/:id', authorize(Role.HR, Role.SUPERVISOR), getSupervisorByIdHandler);
router.patch('/:id', authorize(Role.HR), updateSupervisorHandler);

// GET /api/v1/supervisors/:id/interns — HR sees any, supervisor sees own only
router.get('/:id/interns', authorize(Role.HR, Role.SUPERVISOR), getSupervisorInternsHandler);

export default router;
