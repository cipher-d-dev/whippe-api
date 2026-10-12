import mongoose from 'mongoose';
import { Evaluation, IEvaluationDocument } from './evaluation.model';
import { Intern } from '../interns/intern.model';
import { Supervisor } from '../supervisors/supervisor.model';
import { EvaluationStatus } from './evaluation.types';
import { Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import {
  CreateEvaluationInput,
  UpdateEvaluationInput,
  ListEvaluationsQuery,
} from './evaluation.schema';
import { PaginatedResponse } from '../users/user.types';
import { createNotification } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

// ─── Create (supervisor — saved as DRAFT) ────────────────────────────────────

export async function createEvaluation(
  input: CreateEvaluationInput,
  actorUserId: string,
): Promise<IEvaluationDocument> {
  if (!mongoose.isValidObjectId(input.internId)) throw createError('Invalid internId.', 400);

  const intern = await Intern.findById(input.internId);
  if (!intern) throw createError('Intern not found.', 404);

  const supervisor = await Supervisor.findOne({ user: actorUserId });
  if (!supervisor) throw createError('No supervisor profile found for this account.', 404);

  // Supervisor may only evaluate their own assigned interns
  if (!intern.supervisor || intern.supervisor.toString() !== (supervisor._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only evaluate interns assigned to you.', 403);
  }

  return Evaluation.create({
    intern: new mongoose.Types.ObjectId(input.internId),
    supervisor: supervisor._id,
    scores: input.scores,
    comments: input.comments,
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listEvaluations(
  query: ListEvaluationsQuery,
  actorUserId: string,
  actorRole: Role,
): Promise<PaginatedResponse<IEvaluationDocument>> {
  const { page, limit, intern, supervisor, status } = query;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (status) filter['status'] = status;

  if (actorRole === Role.INTERN) {
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (!internRecord) throw createError('No intern record found.', 404);
    filter['intern'] = internRecord._id;
    // Interns only see submitted evaluations
    filter['status'] = EvaluationStatus.SUBMITTED;
  } else if (actorRole === Role.SUPERVISOR) {
    const supervisorRecord = await Supervisor.findOne({ user: actorUserId });
    if (!supervisorRecord) throw createError('No supervisor profile found.', 404);
    filter['supervisor'] = supervisorRecord._id;
  } else {
    // HR — apply optional filters
    if (intern && mongoose.isValidObjectId(intern)) filter['intern'] = new mongoose.Types.ObjectId(intern);
    if (supervisor && mongoose.isValidObjectId(supervisor)) filter['supervisor'] = new mongoose.Types.ObjectId(supervisor);
  }

  const [data, total] = await Promise.all([
    Evaluation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('intern', 'firstName lastName')
      .populate('supervisor', 'firstName lastName'),
    Evaluation.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getEvaluationById(
  id: string,
  actorUserId: string,
  actorRole: Role,
): Promise<IEvaluationDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid evaluation ID.', 400);

  const evaluation = await Evaluation.findById(id)
    .populate('intern', 'firstName lastName')
    .populate('supervisor', 'firstName lastName');
  if (!evaluation) throw createError('Evaluation not found.', 404);

  // Interns may only see submitted evaluations for themselves
  if (actorRole === Role.INTERN) {
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (
      !internRecord ||
      evaluation.intern.toString() !== (internRecord._id as mongoose.Types.ObjectId).toString() ||
      evaluation.status !== EvaluationStatus.SUBMITTED
    ) {
      throw createError('You do not have permission to view this evaluation.', 403);
    }
  }

  return evaluation;
}

// ─── Update draft (supervisor only) ──────────────────────────────────────────

export async function updateEvaluation(
  id: string,
  input: UpdateEvaluationInput,
  actorUserId: string,
): Promise<IEvaluationDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid evaluation ID.', 400);

  const evaluation = await Evaluation.findById(id);
  if (!evaluation) throw createError('Evaluation not found.', 404);

  if (evaluation.status !== EvaluationStatus.DRAFT) {
    throw createError('Only draft evaluations can be edited.', 409);
  }

  const supervisor = await Supervisor.findOne({ user: actorUserId });
  if (!supervisor || evaluation.supervisor.toString() !== (supervisor._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only update your own evaluations.', 403);
  }

  if (input.scores) Object.assign(evaluation.scores, input.scores);
  if (input.comments) evaluation.comments = input.comments;
  await evaluation.save();
  return evaluation;
}

// ─── Submit (supervisor — DRAFT → SUBMITTED) ──────────────────────────────────

export async function submitEvaluation(
  id: string,
  actorUserId: string,
): Promise<IEvaluationDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid evaluation ID.', 400);

  const evaluation = await Evaluation.findById(id);
  if (!evaluation) throw createError('Evaluation not found.', 404);

  if (evaluation.status !== EvaluationStatus.DRAFT) {
    throw createError('Only draft evaluations can be submitted.', 409);
  }

  const supervisor = await Supervisor.findOne({ user: actorUserId });
  if (!supervisor || evaluation.supervisor.toString() !== (supervisor._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only submit your own evaluations.', 403);
  }

  evaluation.status = EvaluationStatus.SUBMITTED;
  evaluation.submittedAt = new Date();
  await evaluation.save();

  // Notify the intern that a new evaluation has been submitted for them
  const internRecord = await Intern.findById(evaluation.intern);
  if (internRecord) {
    await createNotification(
      internRecord.user.toString(),
      NotificationType.EVALUATION_SUBMITTED,
      'New evaluation submitted',
      'Your supervisor has submitted a performance evaluation for you.',
      { kind: 'Evaluation', id: (evaluation._id as mongoose.Types.ObjectId).toString() },
    ).catch(() => {
      // Notification failure must not block the submit action
    });
  }

  return evaluation;
}
