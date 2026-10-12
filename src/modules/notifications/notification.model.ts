import mongoose, { Schema, Document, Model } from 'mongoose';
import { NotificationType } from './notification.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface INotificationDocument extends Document {
  recipient: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  relatedEntity?: {
    kind: string;
    id: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedEntity: {
      kind: { type: String },
      id: { type: Schema.Types.ObjectId },
    },
  },
  {
    timestamps: true,
  },
);

// Compound index: efficiently fetch a user's unread notifications in order
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
