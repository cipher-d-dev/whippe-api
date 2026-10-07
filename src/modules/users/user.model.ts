import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role, AccountStatus, AuthMethod } from '../auth/auth.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IUser {
  email: string;
  passwordHash?: string;           // undefined for Google-only accounts
  firstName: string;
  lastName: string;
  role: Role;
  status: AccountStatus;
  authMethod: AuthMethod;
  googleId?: string;               // set when authenticated via Google

  // Refresh token — only the SHA-256 hash is stored, never the raw token
  refreshTokenHash?: string;

  // HR verification audit trail
  verificationExpiresAt: Date;     // 30 days after account creation
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Document (instance methods included) ────────────────────────────────────

export interface IUserDocument extends IUser, Document {
  comparePassword(candidate: string): Promise<boolean>;
}

// ─── Model (static methods) ───────────────────────────────────────────────────

export interface IUserModel extends Model<IUserDocument> {
  // extend with statics here if needed later
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUserDocument, IUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      select: false,   // never returned in queries unless explicitly requested
    },

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

    role: {
      type: String,
      enum: Object.values(Role),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.PENDING_HR_VERIFICATION,
    },

    authMethod: {
      type: String,
      enum: Object.values(AuthMethod),
      required: true,
    },

    googleId: {
      type: String,
      sparse: true,   // allows null/undefined while enforcing uniqueness when set
      unique: true,
    },

    // Never expose the hash in normal queries
    refreshTokenHash: {
      type: String,
      select: false,
    },

    // ─── HR verification ─────────────────────────────────────────────────────
    verificationExpiresAt: {
      type: Date,
      required: true,
    },

    verifiedAt: Date,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    rejectedAt: Date,
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Strip sensitive fields from any JSON serialisation automatically
      transform(_doc, ret: Record<string, unknown>) {
        ret['passwordHash'] = undefined;
        ret['refreshTokenHash'] = undefined;
        ret['__v'] = undefined;
        return ret;
      },
    },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// email is already indexed via unique:true
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ verificationExpiresAt: 1 });  // for 30-day cleanup job (Phase 2)

// ─── Instance methods ────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);
