import { z } from 'zod';
import { ReportType, ReportStatus } from '../tasks/task.types';

export const createReportSchema = z.object({
  body: z.object({
    type:        z.nativeEnum(ReportType),
    title:       z.string({ required_error: 'Title is required' }).trim().min(1).max(200),
    content:     z.string({ required_error: 'Content is required' }).trim().min(1),
    periodStart: z.coerce.date({ required_error: 'periodStart is required' }),
    periodEnd:   z.coerce.date({ required_error: 'periodEnd is required' }),
  }),
});
export type CreateReportInput = z.infer<typeof createReportSchema>['body'];

export const updateReportSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title:   z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).optional(),
  }).strict(),
});
export type UpdateReportInput = z.infer<typeof updateReportSchema>['body'];

export const reviewReportSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    feedback: z.string({ required_error: 'Feedback is required' }).trim().min(1).max(1000),
  }),
});
export type ReviewReportInput = z.infer<typeof reviewReportSchema>['body'];

export const listReportsSchema = z.object({
  query: z.object({
    intern: z.string().optional(),
    status: z.string().optional(),
    type:   z.string().optional(),
    page:   z.coerce.number().int().positive().default(1),
    limit:  z.coerce.number().int().positive().max(100).default(20),
  }),
});
export type ListReportsQuery = z.infer<typeof listReportsSchema>['query'];
