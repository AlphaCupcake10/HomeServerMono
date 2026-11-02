import { Schema, model } from "mongoose";
import type { Actor } from "./Setting";

/** Kept for this long, then removed by MongoDB's TTL monitor. */
const RETENTION_SECONDS = 180 * 24 * 60 * 60;

export interface AuditLog {
  actor: Actor | null;
  action: string;
  target?: string;
  details?: unknown;
  createdAt?: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    actor: { type: new Schema<Actor>({ id: String, email: String }, { _id: false }), default: null },
    action: { type: String, required: true, index: true },
    target: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const AuditLogModel = model<AuditLog>("AuditLog", auditLogSchema);
