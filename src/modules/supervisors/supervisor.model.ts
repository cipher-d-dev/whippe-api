import mongoose, { Document, Model, Schema } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISupervisor {
  // Link to the User account — supervisors are staff with a Whippe account
  user: mongoose.Types.ObjectId;

  firstName: string;
  lastName: string;
  phone?: string;

  // The department this supervisor belongs to (optional — a supervisor
  // may oversee interns across departments)
  department?: mongoose.Types.ObjectId;

  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupervisorDocument extends ISupervisor, Document {}
export interface ISupervisorModel extends Model<ISupervisorDocument> {}

// ─── Schema ───────────────────────────────────────────────────────────────────

const supervisorSchema = new Schema<ISupervisorDocument, ISupervisorModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one supervisor profile per user
    },

    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    phone:     { type: String, trim: true },

    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },

    isActive: { type: Boolean, default: true },

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

supervisorSchema.index({ department: 1 });
supervisorSchema.index({ isActive: 1 });

export const Supervisor = mongoose.model<ISupervisorDocument, ISupervisorModel>(
  'Supervisor',
  supervisorSchema,
);
