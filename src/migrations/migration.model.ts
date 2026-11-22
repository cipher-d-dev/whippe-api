import mongoose, { Schema } from 'mongoose';

/** Records one-time data updates that have already run, so they never repeat. */
const migrationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    ranAt: { type: Date, required: true },
    log: { type: [String], default: [] },
  },
  { timestamps: false },
);

export const Migration = mongoose.model('Migration', migrationSchema);
