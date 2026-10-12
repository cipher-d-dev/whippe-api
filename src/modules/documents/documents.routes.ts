import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import {
  createRequirementHandler,
  listRequirementsHandler,
  createDocumentHandler,
  listDocumentsHandler,
  getDocumentByIdHandler,
  markPhysicalReceivedHandler,
  registerUploadHandler,
  reviewDocumentHandler,
  getInternChecklistHandler,
} from './document.controller';

const router = Router();
router.use(authenticate);

// ─── Document requirements ────────────────────────────────────────────────────
router.post('/requirements', authorize(Role.HR), createRequirementHandler);
router.get('/requirements', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), listRequirementsHandler);

// ─── Document records ─────────────────────────────────────────────────────────
router.post('/', authorize(Role.HR), createDocumentHandler);
router.get('/', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), listDocumentsHandler);
router.get('/:id', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getDocumentByIdHandler);

// ─── Document status transitions ──────────────────────────────────────────────
// HR marks physical document received at desk
router.patch('/:id/physical', authorize(Role.HR), markPhysicalReceivedHandler);

// Intern (or HR) registers a file upload to object storage
router.patch('/:id/upload', authorize(Role.HR, Role.INTERN), registerUploadHandler);

// HR verifies or rejects
router.patch('/:id/review', authorize(Role.HR), reviewDocumentHandler);

// ─── Intern checklist ─────────────────────────────────────────────────────────
// GET /api/v1/documents/checklist/:internId
router.get('/checklist/:internId', authorize(Role.HR, Role.SUPERVISOR, Role.INTERN), getInternChecklistHandler);

export default router;
