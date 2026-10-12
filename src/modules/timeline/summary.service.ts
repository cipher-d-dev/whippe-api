import mongoose from 'mongoose';
import { Intern } from '../interns/intern.model';
import { Attendance } from '../attendance/attendance.model';
import { Task } from '../tasks/task.model';
import { Evaluation } from '../evaluations/evaluation.model';
import { DocumentRecord } from '../documents/document.model';
import { createError } from '../../middleware/error-handler';
import { AttendanceStatus } from '../attendance/attendance.types';
import { TaskStatus } from '../tasks/task.types';
import { EvaluationStatus } from '../evaluations/evaluation.types';
import { DocumentStatus } from '../documents/document.types';

// ─── Summary shape ────────────────────────────────────────────────────────────

export interface InternSummary {
  intern: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    internshipType: string;
    startDate?: Date;
    endDate?: Date;
  };
  attendance: {
    totalCheckIns: number;
    accepted: number;
    flagged: number;
    rejected: number;
    corrected: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    changesRequested: number;
    todo: number;
    completionRate: number; // 0–100 percentage
  };
  evaluations: {
    count: number;
    averageScores: {
      workQuality: number;
      reliability: number;
      communication: number;
      learningProgress: number;
      professionalism: number;
      overall: number;
    } | null;
  };
  documents: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
}

// ─── getInternSummary ─────────────────────────────────────────────────────────

export async function getInternSummary(internId: string): Promise<InternSummary> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(internId);
  if (!intern) throw createError('Intern not found.', 404);

  // Fetch all aggregation data in parallel
  const [
    attendanceRecords,
    taskRecords,
    evaluationRecords,
    documentRecords,
  ] = await Promise.all([
    Attendance.find({ intern: internId }).lean(),
    Task.find({ intern: internId }).lean(),
    Evaluation.find({ intern: internId, status: EvaluationStatus.SUBMITTED }).lean(),
    DocumentRecord.find({ intern: internId }).lean(),
  ]);

  // ── Attendance summary ────────────────────────────────────────────────────
  const attendance = {
    totalCheckIns: attendanceRecords.length,
    accepted: attendanceRecords.filter((r) => r.status === AttendanceStatus.ACCEPTED).length,
    flagged: attendanceRecords.filter((r) => r.status === AttendanceStatus.FLAGGED).length,
    rejected: attendanceRecords.filter((r) => r.status === AttendanceStatus.REJECTED).length,
    corrected: attendanceRecords.filter((r) => r.status === AttendanceStatus.CORRECTED).length,
  };

  // ── Task summary ──────────────────────────────────────────────────────────
  const total = taskRecords.length;
  const completed = taskRecords.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const tasks = {
    total,
    completed,
    inProgress: taskRecords.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    changesRequested: taskRecords.filter((t) => t.status === TaskStatus.CHANGES_REQUESTED).length,
    todo: taskRecords.filter((t) => t.status === TaskStatus.TODO).length,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };

  // ── Evaluation summary ────────────────────────────────────────────────────
  let averageScores: InternSummary['evaluations']['averageScores'] = null;

  if (evaluationRecords.length > 0) {
    const n = evaluationRecords.length;
    const sum = evaluationRecords.reduce(
      (acc, ev) => ({
        workQuality: acc.workQuality + ev.scores.workQuality,
        reliability: acc.reliability + ev.scores.reliability,
        communication: acc.communication + ev.scores.communication,
        learningProgress: acc.learningProgress + ev.scores.learningProgress,
        professionalism: acc.professionalism + ev.scores.professionalism,
      }),
      { workQuality: 0, reliability: 0, communication: 0, learningProgress: 0, professionalism: 0 },
    );

    const wq = sum.workQuality / n;
    const rl = sum.reliability / n;
    const cm = sum.communication / n;
    const lp = sum.learningProgress / n;
    const pf = sum.professionalism / n;

    averageScores = {
      workQuality: Math.round(wq * 10) / 10,
      reliability: Math.round(rl * 10) / 10,
      communication: Math.round(cm * 10) / 10,
      learningProgress: Math.round(lp * 10) / 10,
      professionalism: Math.round(pf * 10) / 10,
      overall: Math.round(((wq + rl + cm + lp + pf) / 5) * 10) / 10,
    };
  }

  const evaluations = {
    count: evaluationRecords.length,
    averageScores,
  };

  // ── Document summary ──────────────────────────────────────────────────────
  const documents = {
    total: documentRecords.length,
    verified: documentRecords.filter((d) => d.status === DocumentStatus.VERIFIED).length,
    pending: documentRecords.filter(
      (d) => d.status === DocumentStatus.PENDING ||
             d.status === DocumentStatus.DIGITAL_RECEIVED ||
             d.status === DocumentStatus.PHYSICAL_RECEIVED,
    ).length,
    rejected: documentRecords.filter((d) => d.status === DocumentStatus.REJECTED).length,
  };

  return {
    intern: {
      id: (intern._id as mongoose.Types.ObjectId).toString(),
      firstName: intern.firstName,
      lastName: intern.lastName,
      status: intern.status,
      internshipType: intern.internshipType,
      startDate: intern.startDate,
      endDate: intern.endDate,
    },
    attendance,
    tasks,
    evaluations,
    documents,
  };
}
