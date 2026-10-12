import { Request, Response, NextFunction } from 'express';
import * as documentService from './document.service';
import {
  createRequirementSchema,
  createDocumentSchema,
  markPhysicalSchema,
  registerUploadSchema,
  reviewDocumentSchema,
  listDocumentsSchema,
} from './document.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createRequirementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createRequirementSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const requirement = await documentService.createRequirement(body, actor.id);
    res.status(201).json({ success: true, message: 'Document requirement created.', data: { requirement } });
  } catch (err) { next(err); }
}

export async function listRequirementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requirements = await documentService.listRequirements();
    res.status(200).json({ success: true, data: { requirements } });
  } catch (err) { next(err); }
}

export async function createDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createDocumentSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const document = await documentService.createDocument(body, actor.id);
    res.status(201).json({ success: true, message: 'Document record created.', data: { document } });
  } catch (err) { next(err); }
}

export async function listDocumentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query } = listDocumentsSchema.parse({ query: req.query });
    const actor = getAuthUser(req);
    const result = await documentService.listDocuments(query, actor.id, actor.role);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getDocumentByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const document = await documentService.getDocumentById(req.params.id);
    res.status(200).json({ success: true, data: { document } });
  } catch (err) { next(err); }
}

export async function markPhysicalReceivedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = markPhysicalSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const document = await documentService.markPhysicalReceived(params.id, body.notes, actor.id);
    res.status(200).json({ success: true, message: 'Document marked as physically received.', data: { document } });
  } catch (err) { next(err); }
}

export async function registerUploadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = registerUploadSchema.parse({ params: req.params, body: req.body });
    const document = await documentService.registerUpload(params.id, body);
    res.status(200).json({ success: true, message: 'Upload registered.', data: { document } });
  } catch (err) { next(err); }
}

export async function reviewDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = reviewDocumentSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const document = await documentService.reviewDocument(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Document reviewed.', data: { document } });
  } catch (err) { next(err); }
}

export async function getInternChecklistHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const checklist = await documentService.getInternDocumentChecklist(req.params.internId);
    res.status(200).json({ success: true, data: { checklist } });
  } catch (err) { next(err); }
}
