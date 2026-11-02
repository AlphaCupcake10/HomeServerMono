import type { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { ApiError } from "../utils/errors";

type ValidationSource = "body" | "params" | "query";

/**
 * Validates `req[source]` and replaces it with the coerced value (defaults applied, unknown
 * keys stripped). Express 5 exposes `req.query` as a getter that re-parses the URL on every
 * access, so it has to be shadowed with an own property for the validated value to stick.
 */
export const validate =
  (schema: Joi.ObjectSchema, source: ValidationSource = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error || !value) {
      next(new ApiError(422, error?.message ?? "Validation failed", error?.details));
      return;
    }
    Object.defineProperty(req, source, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
