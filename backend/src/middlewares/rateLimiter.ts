import rateLimit from "express-rate-limit";
import { config } from "../config/config";
import { runtimeSettings } from "../config/runtimeSettings";

// Limits are read per request so edits on the Settings page apply immediately.
// The window length is fixed at startup (config.yaml).
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: () => runtimeSettings.get().rateLimit.max,
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
