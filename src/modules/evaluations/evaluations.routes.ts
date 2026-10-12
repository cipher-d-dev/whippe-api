import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createEvaluationHandler,
  listEvaluationsHandler,
  getEvaluationByIdHandler,
  updateEvaluationHandler,
  submitEvaluationHandler,
} from './evaluation.controller';

const router = Router();
router.use(authenticate);

// Supervisor creates/manages; HR and Intern read (intern sees submitted only)
router.post('/',             authorize(Role.SUPERVISOR),                          createEvaluationHandler);
router.get('/',              authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),    listEvaluationsHandler);
router.get('/:id',           authorize(Role.HR, Role.SUPERVISOR, Role.INTERN),    getEvaluationByIdHandler);
router.patch('/:id',         authorize(Role.SUPERVISOR),                          updateEvaluationHandler);
router.post('/:id/submit',   authorize(Role.SUPERVISOR),                          submitEvaluationHandler);

export default router;
