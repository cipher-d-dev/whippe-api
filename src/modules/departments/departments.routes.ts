import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createDepartmentHandler,
  listDepartmentsHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
} from './department.controller';

const router = Router();

router.use(authenticate);

// GET /api/v1/departments — all authenticated users can read departments
router.get('/', listDepartmentsHandler);
router.get('/:id', getDepartmentByIdHandler);

// HR only — create/update
router.post('/', authorize(Role.HR), createDepartmentHandler);
router.patch('/:id', authorize(Role.HR), updateDepartmentHandler);

export default router;
