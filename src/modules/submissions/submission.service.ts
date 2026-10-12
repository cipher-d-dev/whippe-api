import mongoose from 'mongoose';
import { Submission, ISubmissionDocument } from './submission.model';
import { Task } from '../tasks/task.model';
import { Intern } from '../interns/intern.model';
import { Supervisor } from '../supervisors/supervisor.model';
import { TaskStatus, SubmissionStatus } from '../tasks/task.types';
import { createError } from '../../middleware/error-handler';
import { CreateSubmissionInput, ReviewSubmissionInput } from './submission.schema';

export async function createSubmission(
  input: CreateSubmissionInput,
  actorUserId: string,
): Promise<ISubmissionDocument> {
  const task = await Task.findById(input.taskId);
  if (!task) throw createError('Task not found.', 404);

  const intern = await Intern.findOne({ user: actorUserId });
  if (!intern) throw createError('No intern record found.', 404);

  if (task.intern.toString() !== (intern._id as mongoose.Types.ObjectId).toString()) {
    throw createError('You can only submit work for your own tasks.', 403);
  }

  if (task.status === TaskStatus.COMPLETED) {
    throw createError('This task is already completed.', 409);
  }

  // Update task status to SUBMITTED
  task.status = TaskStatus.SUBMITTED;
  await task.save();

  return Submission.create({
    task: task._id,
    intern: intern._id,
    content: input.content,
  });
}

export async function getSubmissionsByTask(taskId: string): Promise<ISubmissionDocument[]> {
  if (!mongoose.isValidObjectId(taskId)) throw createError('Invalid task ID.', 400);
  return Submission.find({ task: taskId }).sort({ createdAt: -1 });
}

export async function reviewSubmission(
  id: string,
  input: ReviewSubmissionInput,
  actorUserId: string,
): Promise<ISubmissionDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid submission ID.', 400);

  const submission = await Submission.findById(id).populate('task');
  if (!submission) throw createError('Submission not found.', 404);

  const task = submission.task as unknown as { supervisor: mongoose.Types.ObjectId; status: TaskStatus; save: () => Promise<void>; feedback?: string };

  // Verify the reviewer is the task's supervisor
  const supervisor = await Supervisor.findOne({ user: actorUserId });
  if (!supervisor || task.supervisor.toString() !== (supervisor._id as mongoose.Types.ObjectId).toString()) {
    throw createError('Only the assigned supervisor can review this submission.', 403);
  }

  submission.status = input.status;
  submission.feedback = input.feedback;
  submission.reviewedBy = new mongoose.Types.ObjectId(actorUserId);
  submission.reviewedAt = new Date();
  await submission.save();

  // Reflect outcome on the task
  const taskDoc = await Task.findById((submission.task as unknown as { _id: mongoose.Types.ObjectId })._id);
  if (taskDoc) {
    if (input.status === SubmissionStatus.APPROVED) {
      taskDoc.status = TaskStatus.COMPLETED;
      taskDoc.completedAt = new Date();
    } else {
      taskDoc.status = TaskStatus.CHANGES_REQUESTED;
    }
    if (input.feedback) taskDoc.feedback = input.feedback;
    await taskDoc.save();
  }

  return submission;
}
