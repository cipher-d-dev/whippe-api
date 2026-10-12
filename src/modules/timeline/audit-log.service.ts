import mongoose from 'mongoose';
import { AuditLog, IAuditLogDocument } from './audit-log.model';
import { AuditAction } from './audit-log.types';
import { PaginatedResponse } from '../users/user.types';

// ─── Query params shape for listHistory ───────────────────────────────────────

export interface ListHistoryQuery {
  page: number;
  limit: number;
  intern?: string;
  performedBy?: string;
  action?: AuditAction;
}

// ─── logAction ────────────────────────────────────────────────────────────────
// Internal utility — called by other services after important HR actions.
// Fire-and-forget safe: caller wraps in .catch() to avoid blocking main action.

export async function logAction(params: {
  action: AuditAction;
  performedBy: string;
  targetUser?: string;
  targetIntern?: string;
  detail?: string;
}): Promise<IAuditLogDocument> {
  const doc: Record<string, unknown> = {
    action: params.action,
    performedBy: new mongoose.Types.ObjectId(params.performedBy),
  };

  if (params.targetUser) {
    doc['targetUser'] = new mongoose.Types.ObjectId(params.targetUser);
  }
  if (params.targetIntern) {
    doc['targetIntern'] = new mongoose.Types.ObjectId(params.targetIntern);
  }
  if (params.detail) {
    doc['detail'] = params.detail;
  }

  return AuditLog.create(doc);
}

// ─── listHistory ──────────────────────────────────────────────────────────────
// Paginated admin history feed — HR only.
// Supports optional filters: intern, performedBy, action.

export async function listHistory(
  query: ListHistoryQuery,
): Promise<PaginatedResponse<IAuditLogDocument>> {
  const { page, limit, intern, performedBy, action } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (intern && mongoose.isValidObjectId(intern)) {
    filter['targetIntern'] = new mongoose.Types.ObjectId(intern);
  }
  if (performedBy && mongoose.isValidObjectId(performedBy)) {
    filter['performedBy'] = new mongoose.Types.ObjectId(performedBy);
  }
  if (action) {
    filter['action'] = action;
  }

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'firstName lastName email')
      .populate('targetUser', 'firstName lastName email')
      .populate('targetIntern', 'firstName lastName'),
    AuditLog.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
