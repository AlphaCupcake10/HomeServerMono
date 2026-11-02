import { env } from "../config/env";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
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
 * EXPOSE_ERROR_DETAILS is off. Stack traces are never sent in production.
 */
export const describeError = (error: unknown): ErrorDescription | undefined => {
  if (!env.EXPOSE_ERROR_DETAILS) return undefined;
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
