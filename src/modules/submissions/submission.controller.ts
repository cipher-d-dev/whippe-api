import { Request, Response, NextFunction } from 'express';
import * as submissionService from './submission.service';
import { createSubmissionSchema, reviewSubmissionSchema } from './submission.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createSubmissionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createSubmissionSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const submission = await submissionService.createSubmission(body, actor.id);
    res.status(201).json({ success: true, message: 'Work submitted.', data: { submission } });
  } catch (err) { next(err); }
}

export async function getSubmissionsByTaskHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const submissions = await submissionService.getSubmissionsByTask(req.params.taskId);
    res.status(200).json({ success: true, data: { submissions } });
  } catch (err) { next(err); }
}

export async function reviewSubmissionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = reviewSubmissionSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const submission = await submissionService.reviewSubmission(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Submission reviewed.', data: { submission } });
  } catch (err) { next(err); }
}
