import { Request, Response, NextFunction } from 'express';
import * as supervisorService from './supervisor.service';
import {
  createSupervisorSchema,
  updateSupervisorSchema,
  listSupervisorsSchema,
} from './supervisor.schema';
import { getAuthUser } from '../../middleware/auth';
import { Role } from '../auth/auth.types';

export async function createSupervisorHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { body } = createSupervisorSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const supervisor = await supervisorService.createSupervisor(body, actor.id);
    res.status(201).json({ success: true, message: 'Supervisor profile created.', data: { supervisor } });
  } catch (err) { next(err); }
}

export async function listSupervisorsHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { query } = listSupervisorsSchema.parse({ query: req.query });
    const result = await supervisorService.listSupervisors(query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getMySupervisorProfileHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const supervisor = await supervisorService.getSupervisorByUserId(actor.id);
    res.status(200).json({ success: true, data: { supervisor } });
  } catch (err) { next(err); }
}

export async function getSupervisorByIdHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);

    // Supervisors can only view their own profile
    if (actor.role === Role.SUPERVISOR) {
      const own = await supervisorService.getSupervisorByUserId(actor.id);
      if ((own.id as string) !== req.params.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to view this profile.' });
        return;
      }
      res.status(200).json({ success: true, data: { supervisor: own } });
      return;
    }

    const supervisor = await supervisorService.getSupervisorById(req.params.id);
    res.status(200).json({ success: true, data: { supervisor } });
  } catch (err) { next(err); }
}

export async function updateSupervisorHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = updateSupervisorSchema.parse({ params: req.params, body: req.body });
    const supervisor = await supervisorService.updateSupervisor(params.id, body);
    res.status(200).json({ success: true, message: 'Supervisor profile updated.', data: { supervisor } });
  } catch (err) { next(err); }
}

export async function getSupervisorInternsHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    let supervisorId = req.params.id;

    // Supervisors can only see their own assigned interns
    if (actor.role === Role.SUPERVISOR) {
      const own = await supervisorService.getSupervisorByUserId(actor.id);
      if ((own.id as string) !== supervisorId) {
        res.status(403).json({ success: false, message: 'You can only view your own assigned interns.' });
        return;
      }
      supervisorId = own.id as string;
    }

    const interns = await supervisorService.getSupervisorInterns(supervisorId);
    res.status(200).json({ success: true, data: { interns } });
  } catch (err) { next(err); }
}
