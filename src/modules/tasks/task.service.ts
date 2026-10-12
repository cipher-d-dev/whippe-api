import mongoose from 'mongoose';
import { Task, ITaskDocument } from './task.model';
import { Intern } from '../interns/intern.model';
import { Supervisor } from '../supervisors/supervisor.model';
import { TaskStatus } from './task.types';
import { Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from './task.schema';
import { PaginatedResponse } from '../users/user.types';
import { createNotification } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTask(
  input: CreateTaskInput,
  actorUserId: string,
  actorRole: Role,
): Promise<ITaskDocument> {
  if (!mongoose.isValidObjectId(input.internId)) throw createError('Invalid internId.', 400);

  const intern = await Intern.findById(input.internId);
  if (!intern) throw createError('Intern not found.', 404);

  // Resolve the supervisor record for the actor
  const supervisor = await Supervisor.findOne({ user: actorUserId });
  if (!supervisor && actorRole === Role.SUPERVISOR) {
    throw createError('No supervisor profile found for this account.', 404);
  }

  // Supervisors may only assign tasks to their own interns
  if (actorRole === Role.SUPERVISOR) {
    if (!intern.supervisor || intern.supervisor.toString() !== (supervisor!._id as mongoose.Types.ObjectId).toString()) {
      throw createError('You can only assign tasks to your own interns.', 403);
    }
  }

  const supervisorId = actorRole === Role.SUPERVISOR
    ? (supervisor!._id as mongoose.Types.ObjectId)
    : intern.supervisor;

  if (!supervisorId) throw createError('Intern has no assigned supervisor.', 409);

  const task = await Task.create({
    title: input.title,
    description: input.description,
    intern: new mongoose.Types.ObjectId(input.internId),
    createdBy: new mongoose.Types.ObjectId(actorUserId),
    supervisor: supervisorId,
    deadline: input.deadline,
  });

  // Notify the intern that a task has been assigned to them
  await createNotification(
    intern.user.toString(),
    NotificationType.TASK_ASSIGNED,
    'New task assigned',
    `You have been assigned a new task: "${input.title}".`,
    { kind: 'Task', id: (task._id as mongoose.Types.ObjectId).toString() },
  ).catch(() => {
    // Notification failure must not block the task creation
  });

  return task;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listTasks(
  query: ListTasksQuery,
  actorUserId: string,
  actorRole: Role,
): Promise<PaginatedResponse<ITaskDocument>> {
  const { page, limit, intern, supervisor, status } = query;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (status) filter['status'] = status;

  if (actorRole === Role.INTERN) {
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (!internRecord) throw createError('No intern record found.', 404);
    filter['intern'] = internRecord._id;
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
    Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('intern', 'firstName lastName')
      .populate('supervisor', 'firstName lastName'),
    Task.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getTaskById(id: string): Promise<ITaskDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid task ID.', 400);
  const task = await Task.findById(id)
    .populate('intern', 'firstName lastName')
    .populate('supervisor', 'firstName lastName');
  if (!task) throw createError('Task not found.', 404);
  return task;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  actorUserId: string,
  actorRole: Role,
): Promise<ITaskDocument> {
  const task = await getTaskById(id);

  // Interns may only update status (to IN_PROGRESS)
  if (actorRole === Role.INTERN) {
    const allowed: (keyof UpdateTaskInput)[] = ['status'];
    const attempted = Object.keys(input) as (keyof UpdateTaskInput)[];
    const forbidden = attempted.filter(f => !allowed.includes(f));
    if (forbidden.length) throw createError('Interns may only update task status.', 403);

    if (input.status && input.status !== TaskStatus.IN_PROGRESS) {
      throw createError('Interns may only set status to IN_PROGRESS.', 403);
    }

    // Verify ownership
    const internRecord = await Intern.findOne({ user: actorUserId });
    if (!internRecord || task.intern.toString() !== (internRecord._id as mongoose.Types.ObjectId).toString()) {
      throw createError('You can only update your own tasks.', 403);
    }
  }

  // Supervisors may only update tasks they own
  if (actorRole === Role.SUPERVISOR) {
    const supervisorRecord = await Supervisor.findOne({ user: actorUserId });
    if (!supervisorRecord || task.supervisor.toString() !== (supervisorRecord._id as mongoose.Types.ObjectId).toString()) {
      throw createError('You can only update tasks you created.', 403);
    }
    // Supervisors cannot set status to SUBMITTED (that's intern-only via submission)
    if (input.status === TaskStatus.SUBMITTED) throw createError('Use the submission endpoint to submit work.', 400);
    // Mark completedAt when completing
    if (input.status === TaskStatus.COMPLETED) {
      (input as Record<string, unknown>)['completedAt'] = new Date();
    }
  }

  Object.assign(task, input);
  await task.save();

  // When a supervisor sets feedback directly on the task, notify the intern
  if (actorRole === Role.SUPERVISOR && input.feedback) {
    const internRecord = await Intern.findById(task.intern);
    if (internRecord) {
      await createNotification(
        internRecord.user.toString(),
        NotificationType.TASK_FEEDBACK,
        'Feedback on your task',
        `Your supervisor left feedback on task "${task.title}": ${input.feedback}`,
        { kind: 'Task', id: (task._id as mongoose.Types.ObjectId).toString() },
      ).catch(() => {
        // Notification failure must not block the update
      });
    }
  }

  return task;
}
