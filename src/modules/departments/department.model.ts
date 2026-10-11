import mongoose, { Document, Model, Schema } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IDepartment {
  name: string;
  description?: string;
  // Which DAAR Communications subsidiary this department belongs to.
  // Free-form — e.g. "AIT", "Raypower", "Faaji", "Corporate"
  subsidiary?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDepartmentDocument extends IDepartment, Document {}
export interface IDepartmentModel extends Model<IDepartmentDocument> {}

// ─── Schema ───────────────────────────────────────────────────────────────────

const departmentSchema = new Schema<IDepartmentDocument, IDepartmentModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      trim: true,
    },

    subsidiary: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

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
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ subsidiary: 1 });

// ─── Export ───────────────────────────────────────────────────────────────────

export const Department = mongoose.model<IDepartmentDocument, IDepartmentModel>(
  'Department',
  departmentSchema,
);
