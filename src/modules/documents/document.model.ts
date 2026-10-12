import mongoose, { Document, Model, Schema } from 'mongoose';
import { DocumentType, DocumentStatus } from './document.types';

// ─── Document Requirement ─────────────────────────────────────────────────────
// HR defines which documents are required (globally or per intern).

export interface IDocumentRequirement {
  type: DocumentType;
  label: string;          // Human-readable name e.g. "Guarantor Form"
  description?: string;
  isRequired: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentRequirementDocument extends IDocumentRequirement, Document {}
export interface IDocumentRequirementModel extends Model<IDocumentRequirementDocument> {}

const requirementSchema = new Schema<IDocumentRequirementDocument, IDocumentRequirementModel>(
  {
    type:        { type: String, enum: Object.values(DocumentType), required: true },
    label:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isRequired:  { type: Boolean, default: true },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const DocumentRequirement = mongoose.model<IDocumentRequirementDocument, IDocumentRequirementModel>(
  'DocumentRequirement',
  requirementSchema,
);

// ─── Document (intern's actual document record) ───────────────────────────────

export interface IDocument {
  intern: mongoose.Types.ObjectId;
  requirement: mongoose.Types.ObjectId;
  type: DocumentType;
  label: string;
  status: DocumentStatus;

  // Digital file metadata (stored in object storage — not the file itself)
  originalFilename?: string;
  storageKey?: string;        // S3-compatible storage reference
  contentType?: string;       // e.g. "application/pdf"
  fileSizeBytes?: number;
  uploadedAt?: Date;

  // HR review
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentDocument extends IDocument, Document {}
export interface IDocumentModel extends Model<IDocumentDocument> {}

const documentSchema = new Schema<IDocumentDocument, IDocumentModel>(
  {
    intern:      { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    requirement: { type: Schema.Types.ObjectId, ref: 'DocumentRequirement', required: true },
    type:        { type: String, enum: Object.values(DocumentType), required: true },
    label:       { type: String, required: true, trim: true },
    status:      { type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.PENDING },

    originalFilename: String,
    storageKey:       { type: String, select: false },  // never expose storage keys to clients
    contentType:      String,
    fileSizeBytes:    Number,
    uploadedAt:       Date,

    reviewedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:      Date,
    rejectionReason: { type: String, trim: true },
    notes:           { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['__v'] = undefined;
        ret['storageKey'] = undefined;
        return ret;
      },
    },
  },
);

documentSchema.index({ intern: 1, status: 1 });
documentSchema.index({ intern: 1, type: 1 });
documentSchema.index({ requirement: 1 });

export const DocumentRecord = mongoose.model<IDocumentDocument, IDocumentModel>(
  'Document',
  documentSchema,
);
