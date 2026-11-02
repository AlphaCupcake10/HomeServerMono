import type { NextFunction, Request, Response } from "express";
import { ApiError, describeError } from "../utils/errors";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";

interface HttpLikeError {
  status?: number;
  type?: string;
  expose?: boolean;
  code?: number | string;
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, details: err.details }, "Request failed");
    }
    sendError(res, err.statusCode, "API_ERROR", err.message, err.details);
    return;
  }

  const httpErr = err as HttpLikeError | null;

  // Body-parser errors (malformed JSON, payload too large, ...) carry a 4xx status.
  if (httpErr?.type === "entity.parse.failed") {
    sendError(res, 400, "BAD_REQUEST", "Malformed JSON body");
    return;
  }
  if (httpErr?.type === "entity.too.large") {
    sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body too large");
    return;
  }
  if (typeof httpErr?.status === "number" && httpErr.status >= 400 && httpErr.status < 500) {
    sendError(res, httpErr.status, "BAD_REQUEST", "Bad request");
    return;
  }

  // MongoDB duplicate key (e.g. concurrent registrations with the same email).
  if (httpErr?.code === 11000) {
    sendError(res, 409, "CONFLICT", "Resource already exists");
    return;
  }

  if (err instanceof Error) {
    logger.error({ err, stack: err.stack }, "Unhandled error");
  }

  sendError(res, 500, "INTERNAL_ERROR", "Internal server error", describeError(err));
};
