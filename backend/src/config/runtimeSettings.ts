import { config } from "./config";
import type { FeatureKey, RuntimeSettings } from "../validators/settings.validator";

/**
 * The live runtime settings. Starts from the YAML defaults; `SettingsService` replaces the value
 * with the database copy on startup and after every edit. Kept free of other app imports so the
 * logger, error helpers and middlewares can read it without import cycles.
 */
let current: RuntimeSettings = structuredClone(config.runtimeDefaults);

export const runtimeSettings = {
  get: (): RuntimeSettings => current,
  set: (next: RuntimeSettings): void => {
    current = next;
  },
  isFeatureEnabled: (feature: FeatureKey): boolean => current.features[feature]?.enabled === true,
};
