import mongoose from 'mongoose';
import { Intern } from '../interns/intern.model';
import { Attendance } from '../attendance/attendance.model';
import { Task } from '../tasks/task.model';
import { Submission } from '../submissions/submission.model';
import { Report } from '../reports/report.model';
import { Evaluation } from '../evaluations/evaluation.model';
import { DocumentRecord } from '../documents/document.model';
import { createError } from '../../middleware/error-handler';

// ─── Timeline event shape ─────────────────────────────────────────────────────

export interface TimelineEvent {
  type:
    | 'ATTENDANCE'
    | 'TASK_ASSIGNED'
    | 'TASK_COMPLETED'
    | 'SUBMISSION'
    | 'REPORT'
    | 'EVALUATION'
    | 'DOCUMENT';
  date: Date;
  title: string;
  detail?: string;
  refId: string;      // ID of the source document
  refKind: string;    // Collection name for the client to navigate if needed
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface TimelineQuery {
  page: number;
  limit: number;
}

export interface TimelineResult {
  data: TimelineEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── getInternTimeline ────────────────────────────────────────────────────────

export async function getInternTimeline(
  internId: string,
  query: TimelineQuery,
): Promise<TimelineResult> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(internId);
  if (!intern) throw createError('Intern not found.', 404);

  // Fetch all source records in parallel
  const [
    attendanceRecords,
    tasks,
    submissions,
    reports,
    evaluations,
    documents,
  ] = await Promise.all([
    Attendance.find({ intern: internId }).sort({ date: -1 }).lean(),
    Task.find({ intern: internId }).sort({ createdAt: -1 }).lean(),
    Submission.find({ intern: internId }).sort({ createdAt: -1 }).lean(),
    Report.find({ intern: internId }).sort({ createdAt: -1 }).lean(),
    Evaluation.find({ intern: internId, status: 'SUBMITTED' }).sort({ submittedAt: -1 }).lean(),
    DocumentRecord.find({ intern: internId }).sort({ updatedAt: -1 }).lean(),
  ]);

  const events: TimelineEvent[] = [];

  // ── Attendance ────────────────────────────────────────────────────────────
  for (const rec of attendanceRecords) {
    events.push({
      type: 'ATTENDANCE',
      date: rec.submittedAt,
      title: `${rec.checkType === 'CHECK_IN' ? 'Checked in' : 'Checked out'} — ${rec.status}`,
      detail: rec.flagReasons?.length ? `Flags: ${rec.flagReasons.join(', ')}` : undefined,
      refId: (rec._id as mongoose.Types.ObjectId).toString(),
      refKind: 'Attendance',
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  for (const task of tasks) {
    events.push({
      type: 'TASK_ASSIGNED',
      date: task.createdAt,
      title: `Task assigned: "${task.title}"`,
      detail: task.deadline ? `Due: ${task.deadline.toDateString()}` : undefined,
      refId: (task._id as mongoose.Types.ObjectId).toString(),
      refKind: 'Task',
    });

    if (task.completedAt) {
      events.push({
        type: 'TASK_COMPLETED',
        date: task.completedAt,
        title: `Task completed: "${task.title}"`,
        refId: (task._id as mongoose.Types.ObjectId).toString(),
        refKind: 'Task',
      });
    }
  }

  // ── Submissions ───────────────────────────────────────────────────────────
  for (const sub of submissions) {
    events.push({
      type: 'SUBMISSION',
      date: sub.createdAt,
      title: `Submission — ${sub.status.replace(/_/g, ' ')}`,
      detail: sub.feedback ?? undefined,
      refId: (sub._id as mongoose.Types.ObjectId).toString(),
      refKind: 'Submission',
    });
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  for (const report of reports) {
    const dateToUse = report.submittedAt ?? report.createdAt;
    events.push({
      type: 'REPORT',
      date: dateToUse,
      title: `${report.type} report: "${report.title}" — ${report.status}`,
      detail: report.feedback ?? undefined,
      refId: (report._id as mongoose.Types.ObjectId).toString(),
      refKind: 'Report',
    });
  }

  // ── Evaluations ───────────────────────────────────────────────────────────
  for (const evaluation of evaluations) {
    events.push({
      type: 'EVALUATION',
      date: evaluation.submittedAt ?? evaluation.createdAt,
      title: 'Supervisor evaluation submitted',
      detail: evaluation.comments,
      refId: (evaluation._id as mongoose.Types.ObjectId).toString(),
      refKind: 'Evaluation',
    });
  }

  // ── Document status changes ───────────────────────────────────────────────
  for (const doc of documents) {
    if (doc.status !== 'PENDING') {
      events.push({
        type: 'DOCUMENT',
        date: doc.reviewedAt ?? doc.uploadedAt ?? doc.updatedAt,
        title: `Document "${doc.label}" — ${doc.status.replace(/_/g, ' ')}`,
        detail: doc.rejectionReason ?? undefined,
        refId: (doc._id as mongoose.Types.ObjectId).toString(),
        refKind: 'Document',
      });
    }
  }

  // Sort all events newest first
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Paginate in memory
  const { page, limit } = query;
  const total = events.length;
  const start = (page - 1) * limit;
  const data = events.slice(start, start + limit);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
