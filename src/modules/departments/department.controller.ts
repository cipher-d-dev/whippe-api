import { Request, Response, NextFunction } from 'express';
import * as deptService from './department.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
} from './department.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createDepartmentHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { body } = createDepartmentSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const dept = await deptService.createDepartment(body, actor.id);
    res.status(201).json({ success: true, message: 'Department created.', data: { department: dept } });
  } catch (err) { next(err); }
}

export async function listDepartmentsHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { query } = listDepartmentsSchema.parse({ query: req.query });
    const result = await deptService.listDepartments(query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getDepartmentByIdHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dept = await deptService.getDepartmentById(req.params.id);
    res.status(200).json({ success: true, data: { department: dept } });
  } catch (err) { next(err); }
}

export async function updateDepartmentHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = updateDepartmentSchema.parse({ params: req.params, body: req.body });
    const dept = await deptService.updateDepartment(params.id, body);
    res.status(200).json({ success: true, message: 'Department updated.', data: { department: dept } });
  } catch (err) { next(err); }
}

export async function deleteDepartmentHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await deptService.deleteDepartment(req.params.id);
    res.status(200).json({ success: true, message: 'Department deleted successfully.' });
  } catch (err) { next(err); }
}
