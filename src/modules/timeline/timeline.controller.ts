import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/auth';
import { Role } from '../auth/auth.types';
import { Intern } from '../interns/intern.model';
import { createError } from '../../middleware/error-handler';
import { getInternTimeline } from './timeline.service';
import { getInternSummary } from './summary.service';
import { listHistory } from './audit-log.service';
import { AuditAction } from './audit-log.types';

// ─── Shared query schemas ──────────────────────────────────────────────────────

const pageQuery = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

const historyQuery = pageQuery.extend({
  intern: z.string().optional(),
  performedBy: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
});

// ─── Helper — assert intern access ───────────────────────────────────────────
// HR and Supervisors may access any intern's data via :id.
// Interns may only access their own.

async function assertInternAccess(internId: string, actorId: string, actorRole: Role): Promise<void> {
  if (actorRole === Role.HR) return;

  if (actorRole === Role.SUPERVISOR) return; // supervisor scope enforced at higher level if needed

  // Intern — must own the record
  const intern = await Intern.findById(internId).lean();
  if (!intern) throw createError('Intern not found.', 404);

  if (intern.user.toString() !== actorId) {
    throw createError('You do not have permission to access this intern\'s data.', 403);
  }
}

// ─── GET /api/v1/interns/:id/timeline ────────────────────────────────────────

export async function handleGetTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const internId = req.params.id;

    await assertInternAccess(internId, actor.id, actor.role as Role);

    const query = pageQuery.parse(req.query);
    const result = await getInternTimeline(internId, query);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/interns/:id/summary ─────────────────────────────────────────

export async function handleGetSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const internId = req.params.id;

    await assertInternAccess(internId, actor.id, actor.role as Role);

    const summary = await getInternSummary(internId);

    res.status(200).json({ success: true, data: { summary } });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/admin/history ────────────────────────────────────────────────

export async function handleGetAdminHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = historyQuery.parse(req.query);
    const result = await listHistory(query);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
