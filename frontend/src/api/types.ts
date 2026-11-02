// Mirrors the backend's response shapes (backend/src). Keep in sync when the API changes.

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface Session {
  user: User;
  accessToken: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: ApiErrorBody };

// --- Config & runtime settings ---

export type FeatureKey = 'minecraft';

export interface AppConfig {
  features: Record<FeatureKey, { enabled: boolean }>;
}

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

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
  rateLimit?: Partial<RuntimeSettings['rateLimit']>;
};

export interface Actor {
  id: string;
  email: string;
}

export interface AdminSettings {
  values: RuntimeSettings;
  defaults: RuntimeSettings;
  updatedAt: string | null;
  updatedBy: Actor | null;
  /** The read-only YAML config (no secrets). */
  deployment: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  actor: Actor | null;
  action: string;
  target?: string;
  details?: unknown;
  createdAt?: string;
}

// --- Minecraft ---

export interface ServerStatus {
  container: string;
  /** Docker state ("running", "exited", ...) or "missing" when the container doesn't exist. */
  state: string;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  health: string | null;
}

export interface CommandResult {
  command: string;
  response: string;
}
