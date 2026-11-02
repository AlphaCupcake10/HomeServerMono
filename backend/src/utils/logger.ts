import pino from "pino";
import { env } from "../config/env";
import { runtimeSettings } from "../config/runtimeSettings";

// Starts at the default level; SettingsService adjusts `logger.level` when the setting changes.
export const logger = pino({
  level: runtimeSettings.get().logLevel,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
