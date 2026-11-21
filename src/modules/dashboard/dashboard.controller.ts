import { Request, Response, NextFunction } from 'express';
import { getDashboardStats } from './dashboard.service';

// ─── GET /api/v1/admin/dashboard ──────────────────────────────────────────────

export async function getDashboardHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
