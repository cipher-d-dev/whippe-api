import mongoose, { Document, Model, Schema } from 'mongoose';
import { TaskStatus } from './task.types';

export interface ITask {
  title: string;
  description: string;
  intern: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;   // supervisor or HR who created it
  supervisor: mongoose.Types.ObjectId;
  status: TaskStatus;
  deadline?: Date;
  feedback?: string;                    // supervisor feedback on submission
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskDocument extends ITask, Document {}
export interface ITaskModel extends Model<ITaskDocument> {}

const taskSchema = new Schema<ITaskDocument, ITaskModel>(
  {
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    intern:      { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor:  { type: Schema.Types.ObjectId, ref: 'Supervisor', required: true },
    status:      { type: String, enum: Object.values(TaskStatus), default: TaskStatus.TODO },
    deadline:    Date,
    feedback:    { type: String, trim: true },
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['__v'] = undefined;
        return ret;
      },
    },
  },
);

taskSchema.index({ intern: 1, status: 1 });
taskSchema.index({ supervisor: 1, status: 1 });
taskSchema.index({ deadline: 1 });

export const Task = mongoose.model<ITaskDocument, ITaskModel>('Task', taskSchema);
