import mongoose, { Document, Model, Schema } from 'mongoose';
import { AttendanceStatus, CheckType } from './attendance.types';

export interface IAttendance {
  intern: mongoose.Types.ObjectId;
  date: Date;                        // Date only (no time) — used for daily uniqueness
  checkType: CheckType;
  status: AttendanceStatus;

  // Client-submitted signals
  submittedAt: Date;                 // Client timestamp at submission
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;         // metres — lower is better

  // Server-side evaluation
  distanceFromOffice?: number;       // metres computed by server
  withinGeofence?: boolean;

  // Risk signals
  ipAddress?: string;
  userAgent?: string;
  flagReasons?: string[];            // e.g. ['OUTSIDE_GEOFENCE', 'POOR_ACCURACY']

  // HR correction
  correctedBy?: mongoose.Types.ObjectId;
  correctedAt?: Date;
  correctionNote?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendanceDocument extends IAttendance, Document {}
export interface IAttendanceModel extends Model<IAttendanceDocument> {}

const attendanceSchema = new Schema<IAttendanceDocument, IAttendanceModel>(
  {
    intern: { type: Schema.Types.ObjectId, ref: 'Intern', required: true },
    date: { type: Date, required: true },
    checkType: { type: String, enum: Object.values(CheckType), required: true },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      required: true,
    },

    submittedAt: { type: Date, required: true },
    latitude: Number,
    longitude: Number,
    locationAccuracy: Number,

    distanceFromOffice: Number,
    withinGeofence: Boolean,

    ipAddress: { type: String, select: false },
    userAgent: { type: String, select: false },
    flagReasons: [{ type: String }],

    correctedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    correctedAt: Date,
    correctionNote: String,
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

// One check-in and one check-out per intern per day
attendanceSchema.index(
  { intern: 1, date: 1, checkType: 1 },
  { unique: true },
);
attendanceSchema.index({ intern: 1, date: -1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ date: -1 });

export const Attendance = mongoose.model<IAttendanceDocument, IAttendanceModel>(
  'Attendance',
  attendanceSchema,
);
