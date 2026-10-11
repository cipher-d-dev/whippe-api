import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  checkInHandler,
  listAttendanceHandler,
  getAttendanceByIdHandler,
  correctAttendanceHandler,
} from './attendance.controller';

const router = Router();

router.use(authenticate);

// POST /api/v1/attendance/check-in — intern submits check-in or check-out
router.post('/check-in', authorize(Role.INTERN), checkInHandler);

// GET /api/v1/attendance — HR/Supervisor: all records; Intern: own records
router.get('/', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), listAttendanceHandler);

// GET /api/v1/attendance/:id — HR/Supervisor: any; Intern: own only
router.get('/:id', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getAttendanceByIdHandler);

// PATCH /api/v1/attendance/:id/correct — HR only
router.patch('/:id/correct', authorize(Role.HR), correctAttendanceHandler);

export default router;
