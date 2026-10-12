import mongoose, { Document, Model, Schema } from 'mongoose';
import { ReportType, ReportStatus } from '../tasks/task.types';

export interface IReport {
  intern: mongoose.Types.ObjectId;
  type: ReportType;
  title: string;
  content: string;
  status: ReportStatus;
  periodStart: Date;
  periodEnd: Date;
  feedback?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReportDocument extends IReport, Document {}
export interface IReportModel extends Model<IReportDocument> {}

const reportSchema = new Schema<IReportDocument, IReportModel>(
  {
    intern:       { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    type:         { type: String, enum: Object.values(ReportType), required: true },
    title:        { type: String, required: true, trim: true, maxlength: 200 },
    content:      { type: String, required: true, trim: true },
    status:       { type: String, enum: Object.values(ReportStatus), default: ReportStatus.DRAFT },
    periodStart:  { type: Date, required: true },
    periodEnd:    { type: Date, required: true },
    feedback:     { type: String, trim: true },
    reviewedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:   Date,
    submittedAt:  Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) { ret['__v'] = undefined; return ret; },
    },
  },
);

reportSchema.index({ intern: 1, status: 1 });
reportSchema.index({ intern: 1, periodStart: -1 });

export const Report = mongoose.model<IReportDocument, IReportModel>('Report', reportSchema);
