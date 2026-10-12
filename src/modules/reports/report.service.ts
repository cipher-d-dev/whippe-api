import mongoose from 'mongoose';
import { Report, IReportDocument } from './report.model';
import { Intern } from '../interns/intern.model';
import { ReportStatus } from '../tasks/task.types';
import { Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import {
  CreateReportInput,
  UpdateReportInput,
  ReviewReportInput,
  ListReportsQuery,
} from './report.schema';
import { PaginatedResponse } from '../users/user.types';

// ─── Create (intern only — saved as DRAFT) ────────────────────────────────────

export async function createReport(
  input: CreateReportInput,
  actorUserId: string,
): Promise<IReportDocument> {
  const intern = await Intern.findOne({ user: actorUserId });
  if (!intern) throw createError('No intern record found for this account.', 404);

  return Report.create({
    intern: intern._id,
    ...input,
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listReports(
  query: ListReportsQuery,
  actorUserId: string,
  actorRole: Role,
): Promise<PaginatedResponse<IReportDocument>> {
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
    Report.find(filter).sort({ periodStart: -1 }).skip(skip).limit(limit)
      .populate('intern', 'firstName lastName'),
    Report.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getReportById(id: string): Promise<IReportDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid report ID.', 400);
  const report = await Report.findById(id).populate('intern', 'firstName lastName');
  if (!report) throw createError('Report not found.', 404);
  return report;
}

// ─── Update draft (intern only, DRAFT status) ─────────────────────────────────

export async function updateReport(
  id: string,
  input: UpdateReportInput,
  actorUserId: string,
): Promise<IReportDocument> {
  const report = await getReportById(id);

  const intern = await Intern.findOne({ user: actorUserId });
  if (!intern || report.intern.toString() !== (intern._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only update your own reports.', 403);
  }

  if (report.status !== ReportStatus.DRAFT) {
    throw createError('Only draft reports can be edited.', 409);
  }

  Object.assign(report, input);
  await report.save();
  return report;
}

// ─── Submit (intern — moves DRAFT → SUBMITTED) ────────────────────────────────

export async function submitReport(
  id: string,
  actorUserId: string,
): Promise<IReportDocument> {
  const report = await getReportById(id);

  const intern = await Intern.findOne({ user: actorUserId });
  if (!intern || report.intern.toString() !== (intern._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only submit your own reports.', 403);
  }

  if (report.status !== ReportStatus.DRAFT) {
    throw createError('Only draft reports can be submitted.', 409);
  }

  report.status = ReportStatus.SUBMITTED;
  report.submittedAt = new Date();
  await report.save();
  return report;
}

// ─── Review (supervisor/HR) ───────────────────────────────────────────────────

export async function reviewReport(
  id: string,
  input: ReviewReportInput,
  actorUserId: string,
): Promise<IReportDocument> {
  const report = await getReportById(id);

  if (report.status !== ReportStatus.SUBMITTED) {
    throw createError('Only submitted reports can be reviewed.', 409);
  }

  report.status = ReportStatus.REVIEWED;
  report.feedback = input.feedback;
  report.reviewedBy = new mongoose.Types.ObjectId(actorUserId);
  report.reviewedAt = new Date();
  await report.save();
  return report;
}
