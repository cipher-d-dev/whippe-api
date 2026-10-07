import mongoose, { Document, Model, Schema } from 'mongoose';
import { InternshipType, InternshipStatus } from './intern.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IIntern {
  // ── Link to User account ──────────────────────────────────────────────────
  user: mongoose.Types.ObjectId;

  // ── Personal information ──────────────────────────────────────────────────
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;

  // ── School / programme information ────────────────────────────────────────
  institution: string;           // University, polytechnic, etc.
  course: string;                // Course/discipline being studied
  level?: string;                // e.g. 100L, HND 2, NYSC batch

  // ── Internship / placement information ───────────────────────────────────
  internshipType: InternshipType;
  status: InternshipStatus;
  startDate?: Date;
  endDate?: Date;

  // ── Organisational relationships (populated in Phase 4) ───────────────────
  department?: mongoose.Types.ObjectId;
  supervisor?: mongoose.Types.ObjectId;

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdBy: mongoose.Types.ObjectId;   // HR user who created the record
  createdAt: Date;
  updatedAt: Date;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface IInternDocument extends IIntern, Document {}

// ─── Model ────────────────────────────────────────────────────────────────────

export interface IInternModel extends Model<IInternDocument> {}

// ─── Schema ───────────────────────────────────────────────────────────────────

const internSchema = new Schema<IInternDocument, IInternModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,   // one intern record per user account
    },

    // ── Personal ─────────────────────────────────────────────────────────────
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    // ── School ────────────────────────────────────────────────────────────────
    institution: {
      type: String,
      required: true,
      trim: true,
    },

    course: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      trim: true,
    },

    // ── Placement ─────────────────────────────────────────────────────────────
    internshipType: {
      type: String,
      enum: Object.values(InternshipType),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(InternshipStatus),
      default: InternshipStatus.SCREENED,
    },

    startDate: Date,
    endDate: Date,

    // ── Relationships ─────────────────────────────────────────────────────────
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },

    supervisor: {
      type: Schema.Types.ObjectId,
      ref: 'Supervisor',
    },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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

// ─── Indexes ──────────────────────────────────────────────────────────────────
// user is already indexed via unique: true
internSchema.index({ status: 1 });
internSchema.index({ internshipType: 1 });
internSchema.index({ department: 1 });
internSchema.index({ supervisor: 1 });
internSchema.index({ endDate: 1 });   // for upcoming completion queries (Phase 11)

// ─── Export ───────────────────────────────────────────────────────────────────

export const Intern = mongoose.model<IInternDocument, IInternModel>(
  'Intern',
  internSchema,
);
