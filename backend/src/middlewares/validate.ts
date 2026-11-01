import type { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { ApiError } from "../utils/errors";

type ValidationSource = "body" | "params" | "query";

export const validate =
  (schema: Joi.ObjectSchema, source: ValidationSource = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    let result;
    if (source === "body") {
      result = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
    } else if (source === "params") {
      result = schema.validate(req.params, { abortEarly: false, allowUnknown: true });
    } else {
      result = schema.validate(req.query, { abortEarly: false, allowUnknown: true });
    }
    const { error, value } = result;
    if (error || !value) {
      next(new ApiError(422, error?.message ?? "Validation failed", error?.details));
      return;
    }
    if (source === "body") {
      req.body = value;
    } else if (source === "params") {
      req.params = value;
    } else {
      req.query = value;
    }
    next();
  };
