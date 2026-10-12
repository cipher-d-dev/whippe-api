import { z } from 'zod';
import { TaskStatus } from './task.types';

export const createTaskSchema = z.object({
  body: z.object({
    title:       z.string({ required_error: 'Title is required' }).trim().min(1).max(200),
    description: z.string({ required_error: 'Description is required' }).trim().min(1),
    internId:    z.string({ required_error: 'internId is required' }).min(1),
    deadline:    z.coerce.date().optional(),
  }),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];

export const updateTaskSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title:       z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).optional(),
    deadline:    z.coerce.date().optional(),
    status:      z.nativeEnum(TaskStatus).optional(),
    feedback:    z.string().trim().max(1000).optional(),
  }).strict(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];

export const listTasksSchema = z.object({
  query: z.object({
    intern:     z.string().optional(),
    supervisor: z.string().optional(),
    status:     z.string().optional(),
    page:       z.coerce.number().int().positive().default(1),
    limit:      z.coerce.number().int().positive().max(100).default(20),
  }),
});
export type ListTasksQuery = z.infer<typeof listTasksSchema>['query'];
