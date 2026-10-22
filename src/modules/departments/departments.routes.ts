import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createDepartmentHandler,
  listDepartmentsHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
} from './department.controller';

const router = Router();

router.use(authenticate);

// GET /api/v1/departments — all authenticated users can read departments
router.get('/', listDepartmentsHandler);
router.get('/:id', getDepartmentByIdHandler);

// HR only — create/update/delete
router.post('/', authorize(Role.HR), createDepartmentHandler);
router.patch('/:id', authorize(Role.HR), updateDepartmentHandler);
router.delete('/:id', authorize(Role.HR), deleteDepartmentHandler);

export default router;
