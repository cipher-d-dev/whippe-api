import mongoose from 'mongoose';
import { Intern } from './intern.model';
import { Task } from '../tasks/task.model';
import { DocumentRecord } from '../documents/document.model';
import { Evaluation } from '../evaluations/evaluation.model';
import { InternshipStatus } from './intern.types';
import { TaskStatus } from '../tasks/task.types';
import { DocumentStatus } from '../documents/document.types';
import { EvaluationStatus } from '../evaluations/evaluation.types';
import { createError } from '../../middleware/error-handler';
import { logAction } from '../timeline/audit-log.service';
import { AuditAction } from '../timeline/audit-log.types';

// ─── Checklist item shape ─────────────────────────────────────────────────────

export interface ChecklistItem {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ExitChecklist {
  internId: string;
  internName: string;
  canComplete: boolean;   // true only when all required items pass
  items: ChecklistItem[];
}

// ─── getExitChecklist ─────────────────────────────────────────────────────────
// Returns a structured checklist of outstanding items that must be resolved
// before HR can close the internship.

export async function getExitChecklist(internId: string): Promise<ExitChecklist> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(internId);
  if (!intern) throw createError('Intern not found.', 404);

  if (intern.status === InternshipStatus.COMPLETED) {
    throw createError('This internship has already been completed.', 409);
  }

  const internName = `${intern.firstName} ${intern.lastName}`;

  // Fetch all relevant records in parallel
  const [tasks, documents, evaluations] = await Promise.all([
    Task.find({ intern: internId }).lean(),
    DocumentRecord.find({ intern: internId }).lean(),
    Evaluation.find({ intern: internId, status: EvaluationStatus.SUBMITTED }).lean(),
  ]);

  const items: ChecklistItem[] = [];

  // ── 1. No outstanding incomplete tasks ────────────────────────────────────
  const incompleteStatuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.SUBMITTED,
    TaskStatus.CHANGES_REQUESTED,
  ];
  const incompleteTasks = tasks.filter((t) => incompleteStatuses.includes(t.status as TaskStatus));

  items.push({
    label: 'All tasks resolved',
    passed: incompleteTasks.length === 0,
    detail:
      incompleteTasks.length > 0
        ? `${incompleteTasks.length} task(s) still pending completion`
        : undefined,
  });

  // ── 2. No required documents still pending ────────────────────────────────
  const pendingRequiredDocs = documents.filter(
    (d) => d.status === DocumentStatus.PENDING,
  );

  items.push({
    label: 'No required documents pending submission',
    passed: pendingRequiredDocs.length === 0,
    detail:
      pendingRequiredDocs.length > 0
        ? `${pendingRequiredDocs.length} document(s) not yet submitted`
        : undefined,
  });

  // ── 3. At least one evaluation submitted ─────────────────────────────────
  items.push({
    label: 'At least one evaluation submitted',
    passed: evaluations.length > 0,
    detail:
      evaluations.length === 0
        ? 'Supervisor has not submitted any evaluation for this intern'
        : undefined,
  });

  const canComplete = items.every((item) => item.passed);

  return { internId, internName, canComplete, items };
}

// ─── completeInternship ───────────────────────────────────────────────────────
// HR explicitly closes the internship. Sets status → COMPLETED, records
// completedAt and an optional completionNote. Does NOT delete any records.

export async function completeInternship(
  internId: string,
  hrUserId: string,
  completionNote?: string,
): Promise<{ internId: string; internName: string; completedAt: Date; status: InternshipStatus }> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(internId);
  if (!intern) throw createError('Intern not found.', 404);

  if (intern.status === InternshipStatus.COMPLETED) {
    throw createError('This internship has already been completed.', 409);
  }

  // Verify the checklist passes before allowing completion
  const checklist = await getExitChecklist(internId);
  if (!checklist.canComplete) {
    const blocking = checklist.items
      .filter((i) => !i.passed)
      .map((i) => i.label)
      .join('; ');
    throw createError(
      `Cannot complete internship — outstanding items: ${blocking}`,
      422,
    );
  }

  const completedAt = new Date();

  intern.status = InternshipStatus.COMPLETED;
  intern.completedAt = completedAt;
  if (completionNote) intern.completionNote = completionNote;
  await intern.save();

  // Audit log — fire-and-forget
  await logAction({
    action: AuditAction.INTERNSHIP_COMPLETED,
    performedBy: hrUserId,
    targetIntern: internId,
    detail: completionNote,
  }).catch(() => {});

  return {
    internId,
    internName: `${intern.firstName} ${intern.lastName}`,
    completedAt,
    status: InternshipStatus.COMPLETED,
  };
}
