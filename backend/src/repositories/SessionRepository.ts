import { Types } from "mongoose";
import { SessionModel } from "../models/Session";

export const SessionRepository = {
  /** A fresh session id, needed before the session exists because the refresh token embeds it. */
  newId: (): string => new Types.ObjectId().toHexString(),
  create: async (data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }) =>
    SessionModel.create({
      _id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      lastUsedAt: new Date(),
      userAgent: data.userAgent,
    }),
  /** Null for unknown or malformed ids (a token from a foreign or tampered source). */
  findById: async (id: string) =>
    Types.ObjectId.isValid(id) ? SessionModel.findById(id).lean().exec() : null,
  rotate: async (id: string, tokenHash: string, expiresAt: Date) =>
    SessionModel.updateOne({ _id: id }, { tokenHash, expiresAt, lastUsedAt: new Date() }).exec(),
  delete: async (id: string, userId: string) =>
    Types.ObjectId.isValid(id) ? SessionModel.deleteOne({ _id: id, userId }).exec() : null,
  deleteAllForUser: async (userId: string) => SessionModel.deleteMany({ userId }).exec(),
};
