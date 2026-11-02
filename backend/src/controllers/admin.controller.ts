import { asyncHandler } from "../middlewares/asyncHandler";
import { ApiError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import { AuditService } from "../services/AuditService";
import { ContainerService } from "../services/ContainerService";
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

export const listContainers = asyncHandler(async (_req, res) => {
  sendSuccess(res, { containers: await ContainerService.list() });
});

export const getContainerLogs = asyncHandler(async (req, res) => {
  // Coerced by containerLogsQuerySchema.
  const { tail, timestamps } = req.query as unknown as { tail: number; timestamps: boolean };
  const name = String(req.params.name);
  const logs = await ContainerService.logs(name, { tail, timestamps });
  sendSuccess(res, { container: name, logs });
});
