import mongoose, { Document, Schema } from 'mongoose';

/**
 * App-wide wording HR can change from the Configuration page.
 * Stored as a single document (key: "app"); defaults live in settings.service.ts.
 */
export interface ISettings {
  key: string;
  labels: {
    INTERNSHIP?: string;
    NYSC_IT?: string;
  };
  stations: string[];
  /** Monthly stipend per internship type: expected working days and full amount (naira). */
  stipend?: {
    INTERNSHIP?: { days?: number; amount?: number };
    NYSC_IT?: { days?: number; amount?: number };
  };
  /** Face check at check-in: on/off and how close a match must be (0–1). */
  faceCheck?: { enabled?: boolean; threshold?: number };
  /** Who is on payroll by default, per type (HR can override per intern). */
  allowance?: { INTERNSHIP?: boolean; NYSC_IT?: boolean };
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsDocument extends ISettings, Document {}

const settingsSchema = new Schema<ISettingsDocument>(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    labels: {
      INTERNSHIP: { type: String, trim: true },
      NYSC_IT: { type: String, trim: true },
    },
    stations: { type: [String], default: undefined },
    stipend: {
      INTERNSHIP: { days: Number, amount: Number },
      NYSC_IT: { days: Number, amount: Number },
    },
    faceCheck: { enabled: Boolean, threshold: Number },
    allowance: { INTERNSHIP: Boolean, NYSC_IT: Boolean },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Settings = mongoose.model<ISettingsDocument>('Settings', settingsSchema);
