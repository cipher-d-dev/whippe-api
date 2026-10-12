import { Request, Response, NextFunction } from 'express';
import * as taskService from './task.service';
import { createTaskSchema, updateTaskSchema, listTasksSchema } from './task.schema';
import { getAuthUser } from '../../middleware/auth';

export async function createTaskHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = createTaskSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const task = await taskService.createTask(body, actor.id, actor.role);
    res.status(201).json({ success: true, message: 'Task created.', data: { task } });
  } catch (err) { next(err); }
}

export async function listTasksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query } = listTasksSchema.parse({ query: req.query });
    const actor = getAuthUser(req);
    const result = await taskService.listTasks(query, actor.id, actor.role);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getTaskByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.status(200).json({ success: true, data: { task } });
  } catch (err) { next(err); }
}

export async function updateTaskHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { params, body } = updateTaskSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const task = await taskService.updateTask(params.id, body, actor.id, actor.role);
    res.status(200).json({ success: true, message: 'Task updated.', data: { task } });
  } catch (err) { next(err); }
}
