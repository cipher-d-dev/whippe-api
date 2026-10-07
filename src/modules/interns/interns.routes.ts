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
} from './intern.controller';

const router = Router();

// All intern routes require authentication
router.use(authenticate);

// ─── HR only ──────────────────────────────────────────────────────────────────

// POST /api/v1/interns
router.post('/', authorize(Role.HR), createInternHandler);

// GET /api/v1/interns
router.get('/', authorize(Role.HR), listInternsHandler);

// ─── Intern: own record ───────────────────────────────────────────────────────
// Must be declared before /:id to avoid route conflict

// GET /api/v1/interns/me
router.get('/me', authorize(Role.INTERN), getMyInternRecordHandler);

// ─── HR or Intern (ownership enforced in controller) ─────────────────────────

// GET /api/v1/interns/:id
router.get('/:id', authorize(Role.HR, Role.INTERN), getInternByIdHandler);

// PATCH /api/v1/interns/:id
router.patch('/:id', authorize(Role.HR, Role.INTERN), updateInternHandler);

export default router;
