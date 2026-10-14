import mongoose, { Document, Model, Schema } from 'mongoose';
import { SubmissionStatus } from '../tasks/task.types';

export interface ISubmission {
  task: mongoose.Types.ObjectId;
  intern: mongoose.Types.ObjectId;
  content: string;
  status: SubmissionStatus;
  feedback?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubmissionDocument extends ISubmission, Document {}
export interface ISubmissionModel extends Model<ISubmissionDocument> {}

const submissionSchema = new Schema<ISubmissionDocument, ISubmissionModel>(
  {
    task:       { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    intern:     { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    content:    { type: String, required: true, trim: true },
    status:     { type: String, enum: Object.values(SubmissionStatus), default: SubmissionStatus.PENDING_REVIEW },
    feedback:   { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) { ret['__v'] = undefined; return ret; },
    },
  },
);

submissionSchema.index({ task: 1 });
submissionSchema.index({ intern: 1, status: 1 });
submissionSchema.index({ task: 1, intern: 1 }); // supervisor fetches submissions per task

export const Submission = mongoose.model<ISubmissionDocument, ISubmissionModel>('Submission', submissionSchema);
