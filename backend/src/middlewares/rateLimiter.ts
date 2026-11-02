import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config/config";
import { runtimeSettings } from "../config/runtimeSettings";
import { verifyAccessToken } from "../utils/tokens";

/**
 * Signed-in users are accounts the super admin created, and the UI polls (logs every 3s,
 * status, config), so a per-IP budget would lock them out within minutes — and behind Docker
 * Desktop every browser shares one IP. Only a cheap signature check here; `protect` still does
 * the real authentication. An invalid or expired token is counted like an anonymous request.
 */
const hasValidAccessToken = (req: Request): boolean => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    verifyAccessToken(header.slice(7).trim());
    return true;
  } catch {
    return false;
  }
};

// Limits are read per request so edits on the Settings page apply immediately.
// The window length is fixed at startup (config.yaml).
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: () => runtimeSettings.get().rateLimit.max,
  skip: hasValidAccessToken,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Stricter limit for credential endpoints (login / refresh) to slow brute-force attempts.
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: () => runtimeSettings.get().rateLimit.authMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
