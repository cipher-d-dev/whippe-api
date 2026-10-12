import { Request, Response, NextFunction } from 'express';
import * as reportService from './report.service';
import {
  createReportSchema,
  updateReportSchema,
  reviewReportSchema,
  listReportsSchema,
} from './report.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createReportSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const report = await reportService.createReport(body, actor.id);
    res.status(201).json({ success: true, message: 'Report created as draft.', data: { report } });
  } catch (err) { next(err); }
}

export async function listReportsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query } = listReportsSchema.parse({ query: req.query });
    const actor = getAuthUser(req);
    const result = await reportService.listReports(query, actor.id, actor.role);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getReportByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportService.getReportById(req.params.id);
    res.status(200).json({ success: true, data: { report } });
  } catch (err) { next(err); }
}

export async function updateReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = updateReportSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const report = await reportService.updateReport(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Report updated.', data: { report } });
  } catch (err) { next(err); }
}

export async function submitReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const report = await reportService.submitReport(req.params.id, actor.id);
    res.status(200).json({ success: true, message: 'Report submitted.', data: { report } });
  } catch (err) { next(err); }
}

export async function reviewReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = reviewReportSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const report = await reportService.reviewReport(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Report reviewed.', data: { report } });
  } catch (err) { next(err); }
}
