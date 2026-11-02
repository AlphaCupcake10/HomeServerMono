import type { Actor } from "../models/Setting";
import { AuditRepository } from "../repositories/AuditRepository";
import { logger } from "../utils/logger";

export interface AuditEntry {
  id: string;
  actor: Actor | null;
  action: string;
  target?: string;
  details?: unknown;
  createdAt?: Date;
}

export const AuditService = {
  /**
   * Records who did what. Best effort: an audit failure is logged and never fails the request,
   * and entries are skipped while the database is disconnected.
   */
  async record(
    actor: Actor | null | undefined,
    action: string,
    details?: unknown,
    target?: string,
  ): Promise<void> {
    if (!AuditRepository.isAvailable()) {
      logger.debug({ action }, "Audit entry skipped: database not connected");
      return;
    }
    try {
      await AuditRepository.create({
        actor: actor ? { id: actor.id, email: actor.email } : null,
        action,
        target,
        details,
      });
    } catch (err) {
      logger.warn({ err, action }, "Failed to write audit entry");
    }
  },
  async latest(limit: number): Promise<AuditEntry[]> {
    const rows = await AuditRepository.latest(limit);
    return rows.map((row) => ({
      id: String(row._id),
      actor: row.actor ?? null,
      action: row.action,
      target: row.target,
      details: row.details,
      createdAt: row.createdAt,
    }));
  },
};
