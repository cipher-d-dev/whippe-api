import mongoose, { Document, Schema } from 'mongoose';

export enum FacePhotoStatus {
  PENDING = 'PENDING',     // sent, waiting for HR
  APPROVED = 'APPROVED',   // check-ins are compared with it
  REJECTED = 'REJECTED',   // HR asked for a new photo
}

/** An intern's reference face photo and its fingerprints. One per intern. */
export interface IFaceProfile {
  intern: mongoose.Types.ObjectId;
  status: FacePhotoStatus;
  photoKey: string;              // private file in Appwrite storage
  descriptors: number[][];       // 1–3 fingerprints from the enrolment frames
  liveness?: { blink: boolean; real: number; live: number };
  consentAt: Date;
  submittedAt: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFaceProfileDocument extends IFaceProfile, Document {}

const faceProfileSchema = new Schema<IFaceProfileDocument>(
  {
    intern: { type: Schema.Types.ObjectId, ref: 'Intern', required: true, unique: true },
    status: { type: String, enum: Object.values(FacePhotoStatus), required: true, default: FacePhotoStatus.PENDING },
    photoKey: { type: String, required: true, select: false },
    descriptors: { type: [[Number]], required: true, select: false },
    liveness: { blink: Boolean, real: Number, live: Number },
    consentAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true },
);

faceProfileSchema.index({ status: 1, submittedAt: 1 });

export const FaceProfile = mongoose.model<IFaceProfileDocument>('FaceProfile', faceProfileSchema);
