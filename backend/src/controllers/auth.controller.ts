import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { ApiError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import { REFRESH_COOKIE, refreshCookieOptions } from "../utils/tokens";
import { AuthService } from "../services/AuthService";
import { AuditService } from "../services/AuditService";

/** Puts the refresh token in its httpOnly cookie and returns the rest of the session. */
const sendSession = (
  res: Response,
  { refreshToken, ...session }: { refreshToken: string } & Record<string, unknown>,
): void => {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(refreshToken));
  sendSuccess(res, session);
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
};

export const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);
  await AuditService.record(req.user, "user.create", { email: result.user.email }, result.user.id);
  sendSuccess(res, result, 201);
});

// Browsers send the cookie; the body field remains for non-browser clients.
const refreshTokenFrom = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;

export const login = asyncHandler(async (req, res) => {
  sendSession(res, await AuthService.login(req.body, { userAgent: req.get("user-agent") }));
});

export const refresh = asyncHandler(async (req, res) => {
  const token = refreshTokenFrom(req);
  if (!token) {
    throw new ApiError(401, "No refresh token");
  }
  try {
    sendSession(res, await AuthService.refresh(token));
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  // Ends this device's session only; other signed-in devices stay signed in.
  await AuthService.logout(req.user.id, refreshTokenFrom(req));
  clearRefreshCookie(res);
  sendSuccess(res, { message: "Logged out" });
});
