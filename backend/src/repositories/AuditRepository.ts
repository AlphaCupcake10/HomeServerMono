import mongoose from "mongoose";
import { AuditLogModel, type AuditLog } from "../models/AuditLog";

export const AuditRepository = {
  /** Writes while disconnected would wait on Mongoose's command buffer instead of failing fast. */
  isAvailable: (): boolean => mongoose.connection.readyState === mongoose.ConnectionStates.connected,
  create: async (entry: AuditLog) => AuditLogModel.create(entry),
  latest: async (limit: number) =>
    AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec(),
};
