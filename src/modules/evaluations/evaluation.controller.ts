import { Request, Response, NextFunction } from 'express';
import * as evaluationService from './evaluation.service';
import {
  createEvaluationSchema,
  updateEvaluationSchema,
  listEvaluationsSchema,
} from './evaluation.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createEvaluationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createEvaluationSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const evaluation = await evaluationService.createEvaluation(body, actor.id);
    res.status(201).json({ success: true, message: 'Evaluation created as draft.', data: { evaluation } });
  } catch (err) { next(err); }
}

export async function listEvaluationsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query } = listEvaluationsSchema.parse({ query: req.query });
    const actor = getAuthUser(req);
    const result = await evaluationService.listEvaluations(query, actor.id, actor.role);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getEvaluationByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const evaluation = await evaluationService.getEvaluationById(req.params.id, actor.id, actor.role);
    res.status(200).json({ success: true, data: { evaluation } });
  } catch (err) { next(err); }
}

export async function updateEvaluationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = updateEvaluationSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const evaluation = await evaluationService.updateEvaluation(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Evaluation updated.', data: { evaluation } });
  } catch (err) { next(err); }
}

export async function submitEvaluationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const evaluation = await evaluationService.submitEvaluation(req.params.id, actor.id);
    res.status(200).json({ success: true, message: 'Evaluation submitted.', data: { evaluation } });
  } catch (err) { next(err); }
}
