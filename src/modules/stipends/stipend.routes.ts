import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Role } from '../auth/auth.types';
import { getStipendReport } from './stipend.service';

const router = Router();
router.use(authenticate, authorize(Role.HR));

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() });

// GET /api/v1/admin/stipends?from=YYYY-MM-DD&to=YYYY-MM-DD
// Defaults to the current calendar month (Lagos time). `from` alone = that month.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    const report = await getStipendReport(query);
    res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
});

export default router;
