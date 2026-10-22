import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createInternHandler,
  listInternsHandler,
  getMyInternRecordHandler,
  getInternByIdHandler,
  updateInternHandler,
  assignDepartmentHandler,
  removeDepartmentHandler,
  assignSupervisorHandler,
  removeSupervisorHandler,
} from './intern.controller';

const router = Router();

router.use(authenticate);

// ─── HR & Supervisors ────────────────────────────────────────────────────────
router.get('/', authorize(Role.HR, Role.SUPERVISOR), listInternsHandler);

// ─── HR only ──────────────────────────────────────────────────────────────────
router.post('/', authorize(Role.HR), createInternHandler);

// ─── Intern: own record (must be before /:id) ─────────────────────────────────
router.get('/me', authorize(Role.INTERN), getMyInternRecordHandler);

// ─── HR, Supervisor, or Intern (permission enforced in controller) ────────────
router.get('/:id', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getInternByIdHandler);
router.patch('/:id', authorize(Role.HR, Role.INTERN), updateInternHandler);

// ─── Assignment endpoints — HR only ───────────────────────────────────────────

// PUT /api/v1/interns/:id/department  — assign
// DELETE /api/v1/interns/:id/department — remove
router.put('/:id/department', authorize(Role.HR), assignDepartmentHandler);
router.delete('/:id/department', authorize(Role.HR), removeDepartmentHandler);

// PUT /api/v1/interns/:id/supervisor  — assign
// DELETE /api/v1/interns/:id/supervisor — remove
router.put('/:id/supervisor', authorize(Role.HR), assignSupervisorHandler);
router.delete('/:id/supervisor', authorize(Role.HR), removeSupervisorHandler);

export default router;
