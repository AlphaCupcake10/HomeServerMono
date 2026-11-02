import { asyncHandler } from "../middlewares/asyncHandler";
import { ApiError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import { AuditService } from "../services/AuditService";
import { SettingsService } from "../services/SettingsService";

export const getSettings = asyncHandler(async (_req, res) => {
  sendSuccess(res, SettingsService.adminView());
});

export const updateSettings = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  // Validated in SettingsService so unknown keys are rejected rather than stripped.
  sendSuccess(res, await SettingsService.update(req.body, req.user));
});

export const listAudit = asyncHandler(async (req, res) => {
  const entries = await AuditService.latest(Number(req.query.limit));
  sendSuccess(res, { entries });
});
