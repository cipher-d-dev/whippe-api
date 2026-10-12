import { z } from 'zod';
import { DocumentType, DocumentStatus } from './document.types';

// ─── Document Requirement ─────────────────────────────────────────────────────

export const createRequirementSchema = z.object({
  body: z.object({
    type:        z.nativeEnum(DocumentType),
    label:       z.string({ required_error: 'Label is required' }).trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
    isRequired:  z.boolean().default(true),
  }),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>['body'];

// ─── Create document record ───────────────────────────────────────────────────

export const createDocumentSchema = z.object({
  body: z.object({
    internId:      z.string({ required_error: 'internId is required' }).min(1),
    requirementId: z.string({ required_error: 'requirementId is required' }).min(1),
  }),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>['body'];

// ─── Mark physical received ───────────────────────────────────────────────────

export const markPhysicalSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    notes: z.string().trim().max(500).optional(),
  }),
});

// ─── Upload file metadata (after file is uploaded to object storage) ──────────

export const registerUploadSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    originalFilename: z.string({ required_error: 'originalFilename is required' }).trim().min(1),
    storageKey:       z.string({ required_error: 'storageKey is required' }).trim().min(1),
    contentType:      z.string({ required_error: 'contentType is required' }).trim().min(1),
    fileSizeBytes:    z.number().int().positive(),
  }),
});
export type RegisterUploadInput = z.infer<typeof registerUploadSchema>['body'];

// ─── HR review ────────────────────────────────────────────────────────────────

export const reviewDocumentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status:          z.enum([DocumentStatus.VERIFIED, DocumentStatus.REJECTED]),
    rejectionReason: z.string().trim().max(500).optional(),
    notes:           z.string().trim().max(500).optional(),
  }),
});
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>['body'];

// ─── List ─────────────────────────────────────────────────────────────────────

export const listDocumentsSchema = z.object({
  query: z.object({
    intern:  z.string().optional(),
    status:  z.string().optional(),
    type:    z.string().optional(),
    page:    z.coerce.number().int().positive().default(1),
    limit:   z.coerce.number().int().positive().max(100).default(20),
  }),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>['query'];
