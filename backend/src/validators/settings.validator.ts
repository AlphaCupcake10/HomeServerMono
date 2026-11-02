import Joi from "joi";

/** Features that can be switched off at runtime. Add new feature keys here. */
export const FEATURE_KEYS = ["minecraft"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Settings the super admin edits at runtime (stored in MongoDB, seeded from config.yaml). */
export interface RuntimeSettings {
  features: Record<FeatureKey, { enabled: boolean }>;
  exposeErrorDetails: boolean;
  logLevel: LogLevel;
  rateLimit: { max: number; authMax: number };
}

export type RuntimeSettingsUpdate = {
  features?: Partial<Record<FeatureKey, { enabled: boolean }>>;
  exposeErrorDetails?: boolean;
  logLevel?: LogLevel;
  rateLimit?: Partial<RuntimeSettings["rateLimit"]>;
};

const featureSchema = (withDefaults: boolean) =>
  Joi.object({
    enabled: withDefaults ? Joi.boolean().default(true) : Joi.boolean().required(),
  });

const limitSchema = Joi.number().integer().min(1).max(100000);

/** Complete settings; missing values fall back to built-in defaults. */
export const runtimeSettingsSchema = Joi.object({
  features: Joi.object(
    Object.fromEntries(FEATURE_KEYS.map((key) => [key, featureSchema(true).default()])),
  ).default(),
  exposeErrorDetails: Joi.boolean().default(true),
  logLevel: Joi.string()
    .valid(...LOG_LEVELS)
    .default("info"),
  rateLimit: Joi.object({
    max: limitSchema.default(100),
    authMax: limitSchema.default(10),
  }).default(),
});

/** A partial update from the settings editor: at least one value, no unknown keys. */
export const runtimeSettingsUpdateSchema = Joi.object({
  features: Joi.object(
    Object.fromEntries(FEATURE_KEYS.map((key) => [key, featureSchema(false)])),
  ).min(1),
  exposeErrorDetails: Joi.boolean(),
  logLevel: Joi.string().valid(...LOG_LEVELS),
  rateLimit: Joi.object({ max: limitSchema, authMax: limitSchema }).min(1),
}).min(1);
