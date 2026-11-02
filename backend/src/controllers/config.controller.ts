import { asyncHandler } from "../middlewares/asyncHandler";
import { sendSuccess } from "../utils/response";
import { SettingsService } from "../services/SettingsService";

export const getConfig = asyncHandler(async (_req, res) => {
  sendSuccess(res, SettingsService.publicView());
});
