import { config, deepMerge, isPlainObject, type PlainObject } from "../config/config";
import { runtimeSettings } from "../config/runtimeSettings";
import type { Actor } from "../models/Setting";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import {
  runtimeSettingsSchema,
  runtimeSettingsUpdateSchema,
  type RuntimeSettings,
} from "../validators/settings.validator";
import { AuditService } from "./AuditService";

const DOCUMENT_ID = "runtime";

type Change = { from: unknown; to: unknown };

let meta: { updatedAt: Date | null; updatedBy: Actor | null } = {
  updatedAt: null,
  updatedBy: null,
};

/**
 * YAML defaults overlaid with stored values, so settings added later get their defaults without
 * a migration. Unknown stored keys are dropped; an invalid document falls back to the defaults.
 */
const resolve = (stored: unknown): RuntimeSettings => {
  const defaults = structuredClone(config.runtimeDefaults) as unknown as PlainObject;
  const merged = deepMerge(defaults, isPlainObject(stored) ? stored : {});
  const { error, value } = runtimeSettingsSchema.validate(merged, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    logger.warn({ err: error }, "Stored runtime settings are invalid; using the defaults");
    return structuredClone(config.runtimeDefaults);
  }
  return value as RuntimeSettings;
};

const apply = (settings: RuntimeSettings): void => {
  runtimeSettings.set(settings);
  logger.level = settings.logLevel;
};

/** Lists changed leaves as dotted paths, e.g. { "features.minecraft.enabled": { from, to } }. */
const diff = (before: PlainObject, after: PlainObject, prefix = ""): Record<string, Change> => {
  const changes: Record<string, Change> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const path = prefix ? `${prefix}.${key}` : key;
    const [from, to] = [before[key], after[key]];
    if (isPlainObject(from) && isPlainObject(to)) {
      Object.assign(changes, diff(from, to, path));
    } else if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[path] = { from, to };
    }
  }
  return changes;
};

/** Hides credentials if the database URI ever contains them. */
const redactUri = (uri: string): string => uri.replace(/\/\/([^:/@]+):[^@]*@/, "//$1:***@");

const adminView = () => ({
  values: runtimeSettings.get(),
  defaults: config.runtimeDefaults,
  updatedAt: meta.updatedAt,
  updatedBy: meta.updatedBy,
  // Read-only view of the YAML config (no secrets live there).
  deployment: { ...config, database: { ...config.database, uri: redactUri(config.database.uri) } },
});

export type SettingsAdminView = ReturnType<typeof adminView>;

export const SettingsService = {
  /** Loads the stored settings; call once after the database connects. */
  async init(): Promise<void> {
    const document = await SettingsRepository.get(DOCUMENT_ID);
    apply(resolve(document?.values));
    meta = { updatedAt: document?.updatedAt ?? null, updatedBy: document?.updatedBy ?? null };
  },
  get: (): RuntimeSettings => runtimeSettings.get(),
  /** Safe for any signed-in user: drives which features the UI shows. */
  publicView: () => ({ features: runtimeSettings.get().features }),
  adminView,
  async update(partial: unknown, actor: Actor): Promise<SettingsAdminView> {
    const { error, value } = runtimeSettingsUpdateSchema.validate(partial, { abortEarly: false });
    if (error) {
      throw new ApiError(422, error.message, error.details);
    }

    const before = runtimeSettings.get();
    const next = resolve(deepMerge(before as unknown as PlainObject, value as PlainObject));
    const changes = diff(before as unknown as PlainObject, next as unknown as PlainObject);
    if (Object.keys(changes).length === 0) {
      return adminView();
    }

    // Persist first: if the write fails, the live settings stay as they were.
    const saved = await SettingsRepository.save(
      DOCUMENT_ID,
      next as unknown as PlainObject,
      { id: actor.id, email: actor.email },
    );
    apply(next);
    meta = { updatedAt: saved?.updatedAt ?? new Date(), updatedBy: { id: actor.id, email: actor.email } };

    logger.info({ changes, by: actor.email }, "Runtime settings updated");
    await AuditService.record(actor, "settings.update", { changes });
    return adminView();
  },
};
