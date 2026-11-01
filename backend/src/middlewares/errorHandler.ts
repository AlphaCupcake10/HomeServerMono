import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, "API_ERROR", err.message, err.details);
    return;
  }

  if (err instanceof Error) {
    logger.error({ err, stack: err.stack }, "Unhandled error");
  }

  sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
};
