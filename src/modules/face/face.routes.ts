import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, getAuthUser } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import * as face from './face.service';
import { enrolFaceSchema, reviewFaceSchema, listFaceSchema } from './face.schema';

const router = Router();
router.use(authenticate);

type H = (req: Request, res: Response) => Promise<void>;
const wrap = (h: H) => (req: Request, res: Response, next: NextFunction) => h(req, res).catch(next);

const sendImage = (res: Response, buffer: Buffer) => {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
};

// ─── Intern: own face photo ───────────────────────────────────────────────────
router.get('/me', authorize(Role.INTERN), wrap(async (req, res) => {
  res.json({ success: true, data: { face: await face.getMyFace(getAuthUser(req).id) } });
}));

router.post('/me', authorize(Role.INTERN), wrap(async (req, res) => {
  const { body } = enrolFaceSchema.parse({ body: req.body });
  const result = await face.enrolFace(getAuthUser(req).id, body);
  res.status(201).json({ success: true, message: 'Face photo sent to HR.', data: { face: result } });
}));

// ─── HR: review photos and check-in selfies ───────────────────────────────────
router.get('/', authorize(Role.HR), wrap(async (req, res) => {
  const { query } = listFaceSchema.parse({ query: req.query });
  res.json({ success: true, data: { photos: await face.listFacePhotos(query.status) } });
}));

router.get('/checkins/:attendanceId/selfie', authorize(Role.HR), wrap(async (req, res) => {
  sendImage(res, await face.getCheckInSelfie(req.params['attendanceId'] ?? ''));
}));

router.get('/:internId', authorize(Role.HR), wrap(async (req, res) => {
  res.json({ success: true, data: { face: await face.getInternFace(req.params['internId'] ?? '') } });
}));

router.get('/:internId/photo', authorize(Role.HR), wrap(async (req, res) => {
  sendImage(res, await face.getFacePhoto(req.params['internId'] ?? ''));
}));

router.patch('/:internId', authorize(Role.HR), wrap(async (req, res) => {
  const { params, body } = reviewFaceSchema.parse({ params: req.params, body: req.body });
  const result = await face.reviewFace(params.internId, body, getAuthUser(req).id);
  res.json({ success: true, data: { face: result } });
}));

export default router;
