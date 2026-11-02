import { env } from "../config/env";
import { runtimeSettings } from "../config/runtimeSettings";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  /** Machine-readable error code sent to clients (e.g. "FEATURE_DISABLED"). */
  public readonly code: string;

  constructor(statusCode: number, message: string, details?: unknown, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    Error.captureStackTrace(this, ApiError);
  }
}

export interface ErrorDescription {
  name: string;
  message: string;
  code?: string | number;
  stack?: string[];
}

/**
 * Describes an underlying error for inclusion in a response, or `undefined` when
 * the `exposeErrorDetails` runtime setting is off. Stack traces are never sent in production.
 */
export const describeError = (error: unknown): ErrorDescription | undefined => {
  if (!runtimeSettings.get().exposeErrorDetails) return undefined;
  if (!(error instanceof Error)) {
    return { name: "NonError", message: String(error) };
  }
  const { code } = error as { code?: string | number };
  const description: ErrorDescription = { name: error.name, message: error.message };
  if (code !== undefined) description.code = code;
  if (env.NODE_ENV !== "production" && error.stack) {
    description.stack = error.stack.split("\n").slice(1, 8).map((line) => line.trim());
  }
  return description;
};
