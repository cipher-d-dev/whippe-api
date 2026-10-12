import mongoose, { Document, Model, Schema } from 'mongoose';
import { EvaluationStatus, EvaluationScores } from './evaluation.types';

export interface IEvaluation {
  intern: mongoose.Types.ObjectId;
  supervisor: mongoose.Types.ObjectId;
  status: EvaluationStatus;
  scores: EvaluationScores;
  comments: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvaluationDocument extends IEvaluation, Document {}
export interface IEvaluationModel extends Model<IEvaluationDocument> {}

const scoresSchema = new Schema<EvaluationScores>(
  {
    workQuality:      { type: Number, required: true, min: 1, max: 5 },
    reliability:      { type: Number, required: true, min: 1, max: 5 },
    communication:    { type: Number, required: true, min: 1, max: 5 },
    learningProgress: { type: Number, required: true, min: 1, max: 5 },
    professionalism:  { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false },
);

const evaluationSchema = new Schema<IEvaluationDocument, IEvaluationModel>(
  {
    intern:      { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    supervisor:  { type: Schema.Types.ObjectId, ref: 'Supervisor', required: true },
    status:      { type: String, enum: Object.values(EvaluationStatus), default: EvaluationStatus.DRAFT },
    scores:      { type: scoresSchema, required: true },
    comments:    { type: String, required: true, trim: true },
    submittedAt: Date,
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

evaluationSchema.index({ intern: 1, status: 1 });
evaluationSchema.index({ supervisor: 1 });

export const Evaluation = mongoose.model<IEvaluationDocument, IEvaluationModel>(
  'Evaluation',
  evaluationSchema,
);
