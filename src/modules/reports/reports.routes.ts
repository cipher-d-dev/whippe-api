import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createReportHandler,
  listReportsHandler,
  getReportByIdHandler,
  updateReportHandler,
  submitReportHandler,
  reviewReportHandler,
} from './report.controller';

const router = Router();
router.use(authenticate);

router.post('/',           authorize(Role.INTERN),                              createReportHandler);
router.get('/',            authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),    listReportsHandler);
router.get('/:id',         authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),    getReportByIdHandler);
router.patch('/:id',       authorize(Role.INTERN),                              updateReportHandler);
router.post('/:id/submit', authorize(Role.INTERN),                              submitReportHandler);
router.patch('/:id/review',authorize(Role.HR, Role.SUPERVISOR),                 reviewReportHandler);

export default router;
