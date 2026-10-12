import { z } from 'zod';
import { EvaluationStatus } from './evaluation.types';

const scoresSchema = z.object({
  workQuality:      z.number().int().min(1).max(5),
  reliability:      z.number().int().min(1).max(5),
  communication:    z.number().int().min(1).max(5),
  learningProgress: z.number().int().min(1).max(5),
  professionalism:  z.number().int().min(1).max(5),
});

export const createEvaluationSchema = z.object({
  body: z.object({
    internId: z.string({ required_error: 'internId is required' }).min(1),
    scores:   scoresSchema,
    comments: z.string({ required_error: 'Comments are required' }).trim().min(1).max(2000),
  }),
});
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>['body'];

export const updateEvaluationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    scores:   scoresSchema.partial().optional(),
    comments: z.string().trim().min(1).max(2000).optional(),
  }).strict(),
});
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>['body'];

export const listEvaluationsSchema = z.object({
  query: z.object({
    intern:     z.string().optional(),
    supervisor: z.string().optional(),
    status:     z.nativeEnum(EvaluationStatus).optional(),
    page:       z.coerce.number().int().positive().default(1),
    limit:      z.coerce.number().int().positive().max(100).default(20),
  }),
});
export type ListEvaluationsQuery = z.infer<typeof listEvaluationsSchema>['query'];
