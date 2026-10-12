import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/auth';
import { getExitChecklist, completeInternship } from './exit.service';

// ─── GET /api/v1/interns/:id/exit-checklist ───────────────────────────────────

export async function handleGetExitChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const checklist = await getExitChecklist(req.params.id);
    res.status(200).json({ success: true, data: { checklist } });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/interns/:id/complete ───────────────────────────────────────

const completeSchema = z.object({
  completionNote: z.string().trim().max(1000).optional(),
});

export async function handleCompleteInternship(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: hrUserId } = getAuthUser(req);
    const { completionNote } = completeSchema.parse(req.body);

    const result = await completeInternship(req.params.id, hrUserId, completionNote);

    res.status(200).json({
      success: true,
      message: `Internship for ${result.internName} has been completed.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
