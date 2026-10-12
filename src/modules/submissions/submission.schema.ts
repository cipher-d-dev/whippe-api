import { z } from 'zod';
import { SubmissionStatus } from '../tasks/task.types';

export const createSubmissionSchema = z.object({
  body: z.object({
    taskId:  z.string({ required_error: 'taskId is required' }).min(1),
    content: z.string({ required_error: 'Content is required' }).trim().min(1),
  }),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>['body'];

export const reviewSubmissionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status:   z.enum([SubmissionStatus.APPROVED, SubmissionStatus.CHANGES_REQUESTED]),
    feedback: z.string().trim().max(1000).optional(),
  }),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>['body'];
