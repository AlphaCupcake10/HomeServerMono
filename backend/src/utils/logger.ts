import pino from "pino";
import { config } from "../config/config";
import { env } from "../config/env";

export const logger = pino({
  level: config.log.level,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
