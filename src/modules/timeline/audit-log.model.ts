import mongoose, { Schema, Document, Model } from 'mongoose';
import { AuditAction } from './audit-log.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IAuditLog {
  action: AuditAction;
  performedBy: mongoose.Types.ObjectId;   // HR user who performed the action
  targetUser?: mongoose.Types.ObjectId;   // User account affected (approve/reject)
  targetIntern?: mongoose.Types.ObjectId; // Intern record affected (assignments)
  detail?: string;                        // Free-form context (rejection reason, doc label, etc.)
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}
export interface IAuditLogModel extends Model<IAuditLogDocument> {}

// ─── Schema ───────────────────────────────────────────────────────────────────

const auditLogSchema = new Schema<IAuditLogDocument, IAuditLogModel>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    targetIntern: {
      type: Schema.Types.ObjectId,
      ref: 'Intern',
    },
    detail: {
      type: String,
      trim: true,
    },
  },
  {
    // AuditLogs are append-only — no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Query patterns: HR history feed (sorted by date), filter by targetIntern
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetIntern: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const AuditLog: IAuditLogModel =
  (mongoose.models.AuditLog as IAuditLogModel) ||
  mongoose.model<IAuditLogDocument, IAuditLogModel>('AuditLog', auditLogSchema);
