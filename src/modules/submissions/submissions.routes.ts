import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createSubmissionHandler,
  getSubmissionsByTaskHandler,
  reviewSubmissionHandler,
} from './submission.controller';

const router = Router();
router.use(authenticate);

// POST /api/v1/submissions — intern submits work
router.post('/', authorize(Role.INTERN), createSubmissionHandler);

// GET /api/v1/submissions/task/:taskId — view submissions for a task
router.get('/task/:taskId', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getSubmissionsByTaskHandler);

// PATCH /api/v1/submissions/:id/review — supervisor reviews
router.patch('/:id/review', authorize(Role.SUPERVISOR), reviewSubmissionHandler);

export default router;
