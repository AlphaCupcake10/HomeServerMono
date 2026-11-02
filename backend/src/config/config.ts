import fs from "node:fs";
import path from "node:path";
import Joi from "joi";
import { parse } from "yaml";
import type { SignOptions } from "jsonwebtoken";
import { env, type Env } from "./env";
import { runtimeSettingsSchema, type RuntimeSettings } from "../validators/settings.validator";

type Ttl = NonNullable<SignOptions["expiresIn"]>;

/**
 * Non-secret settings, loaded from backend/config/*.yaml. Secrets live in `env`; settings the
 * super admin edits at runtime live in MongoDB (see `runtimeSettings`), seeded from `runtimeDefaults`.
 */
export interface Config {
  server: {
    port: number;
    corsOrigins: string[];
    trustProxy: number;
  };
  database: { uri: string };
  auth: {
    accessTokenTtl: Ttl;
    refreshTokenTtl: Ttl;
    superAdminEmail: string;
    refreshCookieSecure: boolean;
  };
  rateLimit: { windowMs: number };
  /** Initial values for the runtime settings; the database copy wins once it exists. */
  runtimeDefaults: RuntimeSettings;
  /** Containers of this compose project are shown in the admin logs viewer (nothing else). */
  docker: { composeProject: string };
  minecraft: {
    containerName: string;
    /** Absolute path (relative values in YAML resolve against the backend folder). */
    dataDir: string;
    rcon: { host: string; port: number };
  };
}

const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().default(3000),
    corsOrigins: Joi.array().items(Joi.string().min(1)).min(1).default(["http://localhost:3000"]),
    trustProxy: Joi.number().integer().min(0).default(0),
  }).default(),
  database: Joi.object({
    uri: Joi.string().required(),
  }).required(),
  auth: Joi.object({
    accessTokenTtl: Joi.string().default("15m"),
    refreshTokenTtl: Joi.string().default("7d"),
    superAdminEmail: Joi.string().email().required(),
    // Set true when the app is served over HTTPS.
    refreshCookieSecure: Joi.boolean().default(false),
  }).required(),
  rateLimit: Joi.object({
    windowMs: Joi.number().integer().min(1).default(900000),
  }).default(),
  runtimeDefaults: runtimeSettingsSchema.default(),
  docker: Joi.object({
    composeProject: Joi.string()
      .pattern(/^[a-z0-9][a-z0-9_-]*$/)
      .default("backend"),
  }).default(),
  minecraft: Joi.object({
    containerName: Joi.string().required(),
    dataDir: Joi.string().required(),
    rcon: Joi.object({
      host: Joi.string().default("127.0.0.1"),
      port: Joi.number().port().default(25575),
    }).default(),
  }).required(),
});

/** backend/ — two levels up from both src/config (tsx) and dist/config (compiled). */
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "../..");

export type PlainObject = Record<string, unknown>;

export const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Objects merge recursively; arrays and scalars from `override` replace those in `base`. */
export const deepMerge = (base: PlainObject, override: PlainObject): PlainObject => {
  const merged: PlainObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    merged[key] =
      isPlainObject(value) && isPlainObject(merged[key])
        ? deepMerge(merged[key] as PlainObject, value)
        : value;
  }
  return merged;
};

const readYamlFile = (file: string): PlainObject => {
  const parsed: unknown = parse(fs.readFileSync(file, "utf-8"));
  if (parsed === null || parsed === undefined) return {};
  if (!isPlainObject(parsed)) {
    throw new Error(`Config file ${file} must contain a YAML mapping at the top level`);
  }
  return parsed;
};

export interface LoadConfigOptions {
  /** Folder containing config/ (defaults to backend/). */
  rootDir?: string;
  /** Extra file applied after config.yaml; relative to rootDir or absolute. */
  overlay?: string;
  nodeEnv?: Env["NODE_ENV"];
  /** Apply config/config.local.yaml when present. Off under tests for reproducibility. */
  includeLocal?: boolean;
}

export const loadConfig = ({
  rootDir = DEFAULT_ROOT_DIR,
  overlay = process.env.CONFIG_OVERLAY,
  nodeEnv = env.NODE_ENV,
  includeLocal = nodeEnv !== "test",
}: LoadConfigOptions = {}): Config => {
  const baseFile = path.join(rootDir, "config", "config.yaml");
  if (!fs.existsSync(baseFile)) {
    throw new Error(`Config file not found: ${baseFile}`);
  }
  const files = [baseFile];

  if (overlay) {
    const overlayFile = path.resolve(rootDir, overlay);
    if (!fs.existsSync(overlayFile)) {
      throw new Error(`CONFIG_OVERLAY file not found: ${overlayFile}`);
    }
    files.push(overlayFile);
  }

  const localFile = path.join(rootDir, "config", "config.local.yaml");
  if (includeLocal && fs.existsSync(localFile)) {
    files.push(localFile);
  }

  const merged = files.reduce<PlainObject>((acc, file) => deepMerge(acc, readYamlFile(file)), {});
  const { error, value } = configSchema.validate(merged, { abortEarly: false });
  if (error) {
    throw new Error(
      `Invalid configuration (loaded ${files.map((f) => path.relative(rootDir, f)).join(", ")}): ${error.message}`,
    );
  }

  const config = value as Config;
  config.minecraft.dataDir = path.resolve(rootDir, config.minecraft.dataDir);
  return config;
};

/** Env vars that used to hold these settings; they are now ignored. */
const LEGACY_ENV_VARS: Record<string, string> = {
  PORT: "server.port",
  CORS_ORIGINS: "server.corsOrigins",
  TRUST_PROXY: "server.trustProxy",
  EXPOSE_ERROR_DETAILS: "runtimeDefaults.exposeErrorDetails (or the Settings page)",
  MONGODB_URI: "database.uri",
  JWT_EXPIRES_IN: "auth.accessTokenTtl",
  REFRESH_TOKEN_EXPIRES_IN: "auth.refreshTokenTtl",
  SUPER_ADMIN_EMAIL: "auth.superAdminEmail",
  RATE_LIMIT_WINDOW_MS: "rateLimit.windowMs",
  RATE_LIMIT_MAX: "runtimeDefaults.rateLimit.max (or the Settings page)",
  AUTH_RATE_LIMIT_MAX: "runtimeDefaults.rateLimit.authMax (or the Settings page)",
  LOG_LEVEL: "runtimeDefaults.logLevel (or the Settings page)",
  MINECRAFT_CONTAINER_NAME: "minecraft.containerName",
  MINECRAFT_DATA_DIR: "minecraft.dataDir",
  MINECRAFT_RCON_HOST: "minecraft.rcon.host",
  MINECRAFT_RCON_PORT: "minecraft.rcon.port",
};

const legacy = Object.keys(LEGACY_ENV_VARS).filter((key) => process.env[key] !== undefined);
if (legacy.length > 0) {
  // console rather than the logger: the logger itself is configured from `config`.
  console.warn(
    `[config] Ignoring env vars that moved to backend/config/*.yaml: ` +
      legacy.map((key) => `${key} -> ${LEGACY_ENV_VARS[key]}`).join(", "),
  );
}

export const config = loadConfig();
