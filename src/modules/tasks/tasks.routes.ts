import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createTaskHandler,
  listTasksHandler,
  getTaskByIdHandler,
  updateTaskHandler,
} from './task.controller';

const router = Router();
router.use(authenticate);

router.post('/', authorize(Role.HR, Role.SUPERVISOR), createTaskHandler);
router.get('/', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), listTasksHandler);
router.get('/:id', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getTaskByIdHandler);
router.patch('/:id', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), updateTaskHandler);

export default router;
