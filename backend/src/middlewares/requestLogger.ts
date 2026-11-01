import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  logger.info({ method: req.method, url: req.originalUrl, ip: req.ip }, "incoming_request");
  next();
};
