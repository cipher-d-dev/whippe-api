import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as internService from './intern.service';
import { IInternDocument } from './intern.model';
import {
  createInternSchema,
  updateInternSchema,
  listInternsSchema,
} from './intern.schema';
import { getAuthUser } from '../../middleware/auth';
import { Role } from '../auth/auth.types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractUserId(user: IInternDocument['user']): string {
  const asDoc = user as unknown as { _id?: { toString(): string } };
  if (asDoc._id) return asDoc._id.toString();
  return user.toString();
}

// ─── POST /interns ────────────────────────────────────────────────────────────

export async function createInternHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { body } = createInternSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const intern = await internService.createIntern(body, actor.id);
    res.status(201).json({ success: true, message: 'Intern record created.', data: { intern } });
  } catch (err) { next(err); }
}

// ─── GET /interns ─────────────────────────────────────────────────────────────

export async function listInternsHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { query } = listInternsSchema.parse({ query: req.query });
    const result = await internService.listInterns(query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── GET /interns/me ──────────────────────────────────────────────────────────

export async function getMyInternRecordHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const intern = await internService.getInternByUserId(actor.id);
    res.status(200).json({ success: true, data: { intern } });
  } catch (err) { next(err); }
}

// ─── GET /interns/:id ─────────────────────────────────────────────────────────

export async function getInternByIdHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const intern = await internService.getInternById(req.params.id);

    if (actor.role === Role.INTERN && extractUserId(intern.user) !== actor.id) {
      res.status(403).json({ success: false, message: 'You do not have permission to view this record.' });
      return;
    }

    res.status(200).json({ success: true, data: { intern } });
  } catch (err) { next(err); }
}

// ─── PATCH /interns/:id ───────────────────────────────────────────────────────

export async function updateInternHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = updateInternSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);

    if (actor.role === Role.INTERN) {
      const intern = await internService.getInternById(params.id);
      if (extractUserId(intern.user) !== actor.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to update this record.' });
        return;
      }
    }

    const updated = await internService.updateIntern(params.id, body, actor.role);
    res.status(200).json({ success: true, message: 'Intern record updated.', data: { intern: updated } });
  } catch (err) { next(err); }
}

// ─── PUT /interns/:id/department ─────────────────────────────────────────────

const assignSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ departmentId: z.string({ required_error: 'departmentId is required' }).min(1) }),
});

export async function assignDepartmentHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = assignSchema.parse({ params: req.params, body: req.body });
    const intern = await internService.assignDepartment(params.id, body.departmentId);
    res.status(200).json({ success: true, message: 'Department assigned.', data: { intern } });
  } catch (err) { next(err); }
}

export async function removeDepartmentHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const intern = await internService.removeDepartment(req.params.id);
    res.status(200).json({ success: true, message: 'Department removed.', data: { intern } });
  } catch (err) { next(err); }
}

// ─── PUT /interns/:id/supervisor ─────────────────────────────────────────────

const assignSupervisorSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ supervisorId: z.string({ required_error: 'supervisorId is required' }).min(1) }),
});

export async function assignSupervisorHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = assignSupervisorSchema.parse({ params: req.params, body: req.body });
    const intern = await internService.assignSupervisor(params.id, body.supervisorId);
    res.status(200).json({ success: true, message: 'Supervisor assigned.', data: { intern } });
  } catch (err) { next(err); }
}

export async function removeSupervisorHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const intern = await internService.removeSupervisor(req.params.id);
    res.status(200).json({ success: true, message: 'Supervisor removed.', data: { intern } });
  } catch (err) { next(err); }
}
