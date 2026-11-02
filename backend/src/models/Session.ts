import { Schema, model } from "mongoose";

/**
 * One signed-in device/browser. The refresh token carries the session id (`sid`) and is rotated
 * on every refresh; only the hash of the latest token is stored.
 */
export interface Session {
  _id?: unknown;
  userId: string;
  tokenHash: string;
  /** Matches the current refresh token's expiry; MongoDB's TTL monitor removes expired sessions. */
  expiresAt: Date;
  lastUsedAt: Date;
  userAgent?: string;
  createdAt?: Date;
}

const sessionSchema = new Schema<Session>(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<Session>("Session", sessionSchema);
