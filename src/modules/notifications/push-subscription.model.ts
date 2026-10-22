import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IPushSubscriptionDocument extends Document {
  user: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The full push endpoint URL (browser-specific)
    endpoint: {
      type: String,
      required: true,
      unique: true, // one document per device endpoint
    },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
  },
  { timestamps: true },
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const PushSubscription: Model<IPushSubscriptionDocument> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema);
