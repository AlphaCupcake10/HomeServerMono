import { promises as fs } from "fs";
import path from "path";
import docker from "../utils/docker";
import { readContainerLogs, toDockerApiError } from "../utils/dockerHelpers";
import { sendRconCommand } from "../utils/rcon";
import { ApiError, describeError } from "../utils/errors";
import { logger } from "../utils/logger";
import { config } from "../config/config";
import { env } from "../config/env";

const STOP_TIMEOUT_SECONDS = 30;

/** Never returned by the API. */
const HIDDEN_PROPERTIES = new Set(["rcon.password"]);
/** Cannot be changed through the API: editing these would lock the API out of RCON. */
const PROTECTED_PROPERTIES = new Set(["rcon.password", "rcon.port", "enable-rcon"]);

const propertiesPath = (): string => path.join(config.minecraft.dataDir, "server.properties");

/** Serialises read-modify-write cycles on server.properties within this process. */
let propertiesLock: Promise<unknown> = Promise.resolve();
const withPropertiesLock = <T>(task: () => Promise<T>): Promise<T> => {
  const run = propertiesLock.then(task, task);
  propertiesLock = run.catch(() => undefined);
  return run;
};

const toApiError = (error: unknown, alreadyMessage: string): unknown =>
  toDockerApiError(error, {
    notFound: `Container "${config.minecraft.containerName}" does not exist; create it with "make minecraft-create"`,
    notModified: alreadyMessage,
  });

/**
 * Applies `properties` to server.properties content: existing keys are updated in place
 * (comments and layout preserved) and unknown keys are appended.
 */
const mergeProperties = (content: string, properties: Record<string, string>): string => {
  const updatedKeys = new Set<string>();

  const lines = content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    const eq = line.indexOf("=");
    if (eq === -1) return line;

    const key = line.slice(0, eq).trim();
    if (Object.hasOwn(properties, key)) {
      updatedKeys.add(key);
      return `${key}=${properties[key]}`;
    }
    return line;
  });

  // Drop the empty tail left by the trailing newline so the file doesn't grow per update.
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  for (const [key, value] of Object.entries(properties)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return lines.join("\n") + "\n";
};

/**
 * The itzg image only generates server.properties once (OVERRIDE_SERVER_PROPERTIES=false), so a
 * later change to MINECRAFT_RCON_PASSWORD leaves the file stale. The image's own rcon-cli (used
 * for graceful shutdown) and this API then fail to authenticate, and `docker stop` ends in a
 * SIGKILL. Re-assert the RCON settings before every start. Best effort: never blocks start.
 */
const syncRconProperties = (): Promise<void> =>
  withPropertiesLock(async () => {
    try {
      const filePath = propertiesPath();
      const content = await fs.readFile(filePath, "utf-8");
      const merged = mergeProperties(content, {
        "enable-rcon": "true",
        "rcon.password": env.MINECRAFT_RCON_PASSWORD,
      });
      if (merged !== content) {
        await fs.writeFile(filePath, merged, "utf-8");
        logger.info("Synced RCON settings from environment into server.properties");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn({ err: error }, "Could not sync RCON settings into server.properties");
      }
    }
  });

export interface ServerStatus {
  container: string;
  /** Docker's state ("running", "exited", "restarting", ...) or "missing" if not created yet. */
  state: string;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  health: string | null;
}

/** Docker reports never-set timestamps as the zero time. */
const dockerTime = (value?: string): string | null =>
  value && !value.startsWith("0001-01-01") ? value : null;

export const MinecraftService = {
  async status(): Promise<ServerStatus> {
    const container = config.minecraft.containerName;
    try {
      const { State: state } = await docker.getContainer(container).inspect();
      return {
        container,
        state: state.Status,
        running: state.Running,
        startedAt: dockerTime(state.StartedAt),
        finishedAt: dockerTime(state.FinishedAt),
        exitCode: state.Running ? null : state.ExitCode,
        health: state.Health?.Status ?? null,
      };
    } catch (error) {
      if ((error as { statusCode?: number } | null)?.statusCode === 404) {
        return {
          container,
          state: "missing",
          running: false,
          startedAt: null,
          finishedAt: null,
          exitCode: null,
          health: null,
        };
      }
      throw toApiError(error, "Unexpected Docker response");
    }
  },
  async start(): Promise<{ container: string }> {
    await syncRconProperties();
    try {
      await docker.getContainer(config.minecraft.containerName).start();
    } catch (error) {
      throw toApiError(error, "Minecraft server is already running");
    }
    return { container: config.minecraft.containerName };
  },
  async stop(): Promise<{ container: string }> {
    try {
      await docker.getContainer(config.minecraft.containerName).stop({ t: STOP_TIMEOUT_SECONDS });
    } catch (error) {
      throw toApiError(error, "Minecraft server is already stopped");
    }
    return { container: config.minecraft.containerName };
  },
  async getLogs(tail: number): Promise<string> {
    try {
      return await readContainerLogs(docker.getContainer(config.minecraft.containerName), { tail });
    } catch (error) {
      throw toApiError(error, "Unexpected Docker response");
    }
  },
  async sendCommand(command: string): Promise<string> {
    try {
      return await sendRconCommand(
        {
          host: config.minecraft.rcon.host,
          port: config.minecraft.rcon.port,
          password: env.MINECRAFT_RCON_PASSWORD,
        },
        command,
      );
    } catch (error) {
      throw new ApiError(
        503,
        "Could not run the command over RCON. The Minecraft server may be stopped or still starting.",
        describeError(error),
      );
    }
  },
  async updateProperties(properties: Record<string, string>): Promise<{ updated: boolean }> {
    const blocked = Object.keys(properties).filter((key) => PROTECTED_PROPERTIES.has(key));
    if (blocked.length > 0) {
      throw new ApiError(
        422,
        `These properties cannot be changed via the API: ${blocked.join(", ")}`,
      );
    }

    return withPropertiesLock(async () => {
      const filePath = propertiesPath();
      let content: string;
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new ApiError(404, "server.properties not found; start the server once to generate it");
        }
        throw error;
      }
      // The server only reads server.properties on startup; changes apply after a restart.
      await fs.writeFile(filePath, mergeProperties(content, properties), "utf-8");
      return { updated: true };
    });
  },
  async getProperties(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(propertiesPath(), "utf-8");
      const properties: Record<string, string> = {};

      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eq = line.indexOf("=");
        if (eq > -1) {
          const key = line.slice(0, eq).trim();
          if (!HIDDEN_PROPERTIES.has(key)) {
            properties[key] = line.slice(eq + 1).trim();
          }
        }
      }

      return properties;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  },
};
