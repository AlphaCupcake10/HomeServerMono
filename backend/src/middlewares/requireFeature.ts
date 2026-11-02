import type { NextFunction, Request, Response } from "express";
import { runtimeSettings } from "../config/runtimeSettings";
import { ApiError } from "../utils/errors";
import type { FeatureKey } from "../validators/settings.validator";

const FEATURE_NAMES: Record<FeatureKey, string> = {
  minecraft: "Minecraft",
};

/** Rejects every request to a feature the super admin has switched off (checked per request). */
export const requireFeature =
  (feature: FeatureKey) =>
  (_req: Request, _res: Response, next: NextFunction): void => {
    if (!runtimeSettings.isFeatureEnabled(feature)) {
      next(
        new ApiError(
          403,
          `The ${FEATURE_NAMES[feature]} feature is disabled`,
          { feature },
          "FEATURE_DISABLED",
        ),
      );
      return;
    }
    next();
  };
