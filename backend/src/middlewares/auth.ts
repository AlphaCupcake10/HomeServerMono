import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./asyncHandler";
import { ApiError } from "../utils/errors";
import { UserRepository } from "../repositories/UserRepository";
import { verifyAccessToken } from "../utils/tokens";

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    const sub = typeof payload === "string" ? undefined : payload.sub;
    const user = sub ? await UserRepository.findById(sub) : null;
    if (!user) {
      next(new ApiError(401, "Unauthorized"));
      return;
    }
    req.user = { id: String(user._id), email: user.email, role: user.role };
    next();
  } catch {
    next(new ApiError(401, "Unauthorized"));
  }
});

/** Must run after `protect`. */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== "admin") {
    next(new ApiError(403, "Forbidden"));
    return;
  }
  next();
};
