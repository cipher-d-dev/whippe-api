import mongoose from 'mongoose';
import { DocumentRequirement, DocumentRecord, IDocumentDocument, IDocumentRequirementDocument } from './document.model';
import { Intern } from '../interns/intern.model';
import { DocumentStatus } from './document.types';
import { Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import {
  CreateRequirementInput,
  CreateDocumentInput,
  RegisterUploadInput,
  ReviewDocumentInput,
  ListDocumentsQuery,
} from './document.schema';
import { PaginatedResponse } from '../users/user.types';
import { createNotification } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';
import { logAction } from '../timeline/audit-log.service';
import { AuditAction } from '../timeline/audit-log.types';
import { generateUploadInfo, downloadFile, UploadInfo } from '../../lib/appwrite';

// ─── Requirements ─────────────────────────────────────────────────────────────

export async function createRequirement(
  input: CreateRequirementInput,
  hrUserId: string,
): Promise<IDocumentRequirementDocument> {
  return DocumentRequirement.create({
    ...input,
    createdBy: new mongoose.Types.ObjectId(hrUserId),
  });
}

export async function listRequirements(): Promise<IDocumentRequirementDocument[]> {
  return DocumentRequirement.find().sort({ label: 1 });
}

// ─── Create document record for an intern ────────────────────────────────────

export async function createDocument(
  input: CreateDocumentInput,
  hrUserId: string,
): Promise<IDocumentDocument> {
  if (!mongoose.isValidObjectId(input.internId)) throw createError('Invalid internId.', 400);
  if (!mongoose.isValidObjectId(input.requirementId)) throw createError('Invalid requirementId.', 400);

  const [intern, requirement] = await Promise.all([
    Intern.findById(input.internId),
    DocumentRequirement.findById(input.requirementId),
  ]);

  if (!intern) throw createError('Intern not found.', 404);
  if (!requirement) throw createError('Document requirement not found.', 404);

  // Prevent duplicates
  const existing = await DocumentRecord.findOne({
    intern: input.internId,
    requirement: input.requirementId,
  });
  if (existing) throw createError('A document record already exists for this intern and requirement.', 409);

  return DocumentRecord.create({
    intern: new mongoose.Types.ObjectId(input.internId),
    requirement: new mongoose.Types.ObjectId(input.requirementId),
    type: requirement.type,
    label: requirement.label,
    createdBy: new mongoose.Types.ObjectId(hrUserId),
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listDocuments(
  query: ListDocumentsQuery,
  actorUserId: string,
  actorRole: Role,
): Promise<PaginatedResponse<IDocumentDocument>> {
  const { page, limit, intern, status, type } = query;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (status) filter['status'] = status;
  if (type) filter['type'] = type;

  if (actorRole === Role.INTERN) {
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (!internRecord) throw createError('No intern record found.', 404);
    filter['intern'] = internRecord._id;
  } else if (intern && mongoose.isValidObjectId(intern)) {
    filter['intern'] = new mongoose.Types.ObjectId(intern);
  }

  const [data, total] = await Promise.all([
    DocumentRecord.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('intern', 'firstName lastName')
      .populate('requirement', 'label type'),
    DocumentRecord.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getDocumentById(id: string): Promise<IDocumentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);
  const doc = await DocumentRecord.findById(id)
    .populate('intern', 'firstName lastName')
    .populate('requirement', 'label type');
  if (!doc) throw createError('Document record not found.', 404);
  return doc;
}

// ─── Mark physical received (HR at desk) ─────────────────────────────────────

export async function markPhysicalReceived(
  id: string,
  notes: string | undefined,
  hrUserId: string,
): Promise<IDocumentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);

  const doc = await DocumentRecord.findByIdAndUpdate(
    id,
    {
      status: DocumentStatus.PHYSICAL_RECEIVED,
      reviewedBy: new mongoose.Types.ObjectId(hrUserId),
      reviewedAt: new Date(),
      ...(notes ? { notes } : {}),
    },
    { new: true },
  );
  if (!doc) throw createError('Document record not found.', 404);
  return doc;
}

// ─── Register uploaded file metadata (after upload to object storage) ─────────

export async function registerUpload(
  id: string,
  input: RegisterUploadInput,
): Promise<IDocumentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);

  const doc = await DocumentRecord.findByIdAndUpdate(
    id,
    {
      status: DocumentStatus.DIGITAL_RECEIVED,
      originalFilename: input.originalFilename,
      storageKey: input.storageKey,
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
      uploadedAt: new Date(),
    },
    { new: true },
  );
  if (!doc) throw createError('Document record not found.', 404);
  return doc;
}

// ─── HR review (verify or reject) ────────────────────────────────────────────

export async function reviewDocument(
  id: string,
  input: ReviewDocumentInput,
  hrUserId: string,
): Promise<IDocumentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);

  const doc = await DocumentRecord.findById(id);
  if (!doc) throw createError('Document record not found.', 404);

  if (doc.status === DocumentStatus.PENDING) {
    throw createError('Cannot review a document that has not been received yet.', 409);
  }

  doc.status = input.status;
  doc.reviewedBy = new mongoose.Types.ObjectId(hrUserId);
  doc.reviewedAt = new Date();
  if (input.rejectionReason) doc.rejectionReason = input.rejectionReason;
  if (input.notes) doc.notes = input.notes;
  await doc.save();

  // Notify the intern that their document status has changed
  const internRecord = await Intern.findById(doc.intern);
  if (internRecord) {
    await createNotification(
      internRecord.user.toString(),
      NotificationType.DOCUMENT_STATUS_CHANGED,
      'Document status updated',
      `The status of your document "${doc.label}" has been updated to: ${input.status.replace(/_/g, ' ').toLowerCase()}.`,
      { kind: 'Document', id: (doc._id as mongoose.Types.ObjectId).toString() },
    ).catch(() => {});
  }

  await logAction({
    action: AuditAction.DOCUMENT_REVIEWED,
    performedBy: hrUserId,
    targetIntern: doc.intern.toString(),
    detail: `"${doc.label}" → ${input.status}${input.rejectionReason ? `: ${input.rejectionReason}` : ''}`,
  }).catch(() => {});

  return doc;
}

// ─── Get intern's document checklist ─────────────────────────────────────────
// Returns all requirements with the intern's corresponding document status.

export async function getInternDocumentChecklist(internId: string): Promise<{
  requirement: IDocumentRequirementDocument;
  document: IDocumentDocument | null;
}[]> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const [requirements, documents] = await Promise.all([
    DocumentRequirement.find().sort({ label: 1 }),
    DocumentRecord.find({ intern: internId }),
  ]);

  return requirements.map((req) => ({
    requirement: req,
    document: documents.find(
      (d) => d.requirement.toString() === (req._id as mongoose.Types.ObjectId).toString(),
    ) ?? null,
  }));
}


// ─── Get Appwrite upload info ─────────────────────────────────────────────────
// Returns the endpoint, project, bucket, and a pre-generated fileId that the
// client uses to upload directly to Appwrite via the client SDK.
// The document record is NOT updated here — the client confirms via registerUpload.

export async function getDocumentUploadInfo(id: string): Promise<UploadInfo> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);

  const doc = await DocumentRecord.findById(id);
  if (!doc) throw createError('Document record not found.', 404);

  return generateUploadInfo();
}

// ─── Download document file ───────────────────────────────────────────────────
// Fetches the file from Appwrite and returns its content + metadata for streaming.
// storageKey is loaded with select: false — never returned to the client directly.

export async function downloadDocument(
  id: string,
  actorUserId: string,
  actorRole: Role,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid document ID.', 400);

  // Explicitly select storageKey — it is select:false on the schema
  const doc = await DocumentRecord.findById(id).select('+storageKey');
  if (!doc) throw createError('Document record not found.', 404);

  // Interns may only download their own documents
  if (actorRole === Role.INTERN) {
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (!internRecord || doc.intern.toString() !== (internRecord._id as mongoose.Types.ObjectId).toString()) {
      throw createError('You do not have permission to download this document.', 403);
    }
  }

  if (!doc.storageKey) {
    throw createError('No file has been uploaded for this document yet.', 404);
  }

  const buffer = await downloadFile(doc.storageKey);

  return {
    buffer,
    contentType: doc.contentType ?? 'application/octet-stream',
    filename: doc.originalFilename ?? 'document',
  };
}
