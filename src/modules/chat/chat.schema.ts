import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

export const MAX_TEXT = 4000;
export const MAX_ATTACHMENTS = 5;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

/** HR opens a chat with an intern or a supervisor; an intern opens their HR chat (no body). */
export const openConversationSchema = z.object({
  body: z
    .object({ internId: objectId.optional(), userId: objectId.optional() })
    .strict()
    .refine((b) => !(b.internId && b.userId), 'Choose an intern or a person, not both'),
});

export const listConversationsSchema = z.object({
  query: z.object({
    search: z.string().trim().max(80).optional(),
    kind: z.enum(['INTERN_HR', 'STAFF_DM', 'INTERN_DM']).optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
  }),
});

export const listMessagesSchema = z.object({
  params: z.object({ id: objectId }),
  query: z
    .object({
      before: objectId.optional(),   // older than this message
      after: objectId.optional(),    // newer than this message
      around: objectId.optional(),   // a page centred on this message (jump to a reply)
      limit: z.coerce.number().int().positive().max(100).default(40),
    })
    .refine((q) => [q.before, q.after, q.around].filter(Boolean).length <= 1, 'Use one of before, after or around'),
});

export const sendMessageSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      text: z.string().max(MAX_TEXT, `Keep messages under ${MAX_TEXT} characters`).default(''),
      replyTo: objectId.optional(),
      uploads: z.array(objectId).max(MAX_ATTACHMENTS).default([]),
      clientId: z.string().min(1).max(64).optional(),
    })
    .strict()
    .refine((b) => b.text.trim().length > 0 || b.uploads.length > 0, 'Type a message or attach a file'),
});

export const editMessageSchema = z.object({
  params: z.object({ messageId: objectId }),
  body: z.object({ text: z.string().trim().min(1, 'Message cannot be empty').max(MAX_TEXT) }).strict(),
});

export const messageIdSchema = z.object({ params: z.object({ messageId: objectId }) });
export const attachmentSchema = z.object({
  params: z.object({ messageId: objectId, index: z.coerce.number().int().min(0).max(MAX_ATTACHMENTS - 1) }),
});
export const conversationIdSchema = z.object({ params: z.object({ id: objectId }) });

export const uploadQuerySchema = z.object({
  query: z.object({ name: z.string().trim().min(1).max(120) }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>['body'];

export const reportSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      reason: z.string().trim().min(3, 'Say briefly what happened').max(500),
      messageId: objectId.optional(),
      block: z.boolean().default(false),
    })
    .strict(),
});
