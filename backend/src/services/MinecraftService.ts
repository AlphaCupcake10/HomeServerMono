import { promises as fs } from "fs";
import path from "path";
import docker from "../utils/docker";
import { sendRconCommand } from "../utils/rcon";
import { ApiError, describeError } from "../utils/errors";
import { env } from "../config/env";

const STOP_TIMEOUT_SECONDS = 30;

/** Never returned by the API. */
const HIDDEN_PROPERTIES = new Set(["rcon.password"]);
/** Cannot be changed through the API: editing these would lock the API out of RCON. */
const PROTECTED_PROPERTIES = new Set(["rcon.password", "rcon.port", "enable-rcon"]);

const propertiesPath = (): string => path.join(env.MINECRAFT_DATA_DIR, "server.properties");

/** Serialises read-modify-write cycles on server.properties within this process. */
let propertiesLock: Promise<unknown> = Promise.resolve();
const withPropertiesLock = <T>(task: () => Promise<T>): Promise<T> => {
  const run = propertiesLock.then(task, task);
  propertiesLock = run.catch(() => undefined);
  return run;
};

/** Translates Docker daemon errors (dockerode sets `statusCode`) into API errors. */
const toApiError = (error: unknown, alreadyMessage: string): unknown => {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  if (statusCode === 304) return new ApiError(409, alreadyMessage);
  if (statusCode === 404) {
    return new ApiError(
      404,
      `Container "${env.MINECRAFT_CONTAINER_NAME}" does not exist; create it with "make minecraft-create"`,
      describeError(error),
    );
  }
  if (statusCode !== undefined) {
    return new ApiError(502, "Docker daemon returned an error", describeError(error));
  }
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === "ENOENT" || code === "ECONNREFUSED" || code === "EACCES") {
    return new ApiError(502, "Cannot reach the Docker daemon (is the socket mounted?)", describeError(error));
  }
  return error;
};

const parseDockerLogs = (buffer: Buffer): string => {
  // Docker multiplexes stdout/stderr as frames: 1 byte stream, 3 bytes padding, 4 bytes length.
  let offset = 0;
  let output = "";
  while (offset + 8 <= buffer.length) {
    const payloadLength = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = Math.min(start + payloadLength, buffer.length);
    output += buffer.toString("utf-8", start, end);
    offset = end;
  }
  return output;
};

export const MinecraftService = {
  async start(): Promise<{ container: string }> {
    try {
      await docker.getContainer(env.MINECRAFT_CONTAINER_NAME).start();
    } catch (error) {
      throw toApiError(error, "Minecraft server is already running");
    }
    return { container: env.MINECRAFT_CONTAINER_NAME };
  },
  async stop(): Promise<{ container: string }> {
    try {
      await docker.getContainer(env.MINECRAFT_CONTAINER_NAME).stop({ t: STOP_TIMEOUT_SECONDS });
    } catch (error) {
      throw toApiError(error, "Minecraft server is already stopped");
    }
    return { container: env.MINECRAFT_CONTAINER_NAME };
  },
  async getLogs(tail: number): Promise<string> {
    try {
      const container = docker.getContainer(env.MINECRAFT_CONTAINER_NAME);
      const info = await container.inspect();
      const buffer = (await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
        tail,
      })) as unknown as Buffer;
      // TTY containers return a raw stream instead of multiplexed frames.
      return info.Config?.Tty ? buffer.toString("utf-8") : parseDockerLogs(buffer);
    } catch (error) {
      throw toApiError(error, "Unexpected Docker response");
    }
  },
  async sendCommand(command: string): Promise<string> {
    try {
      return await sendRconCommand(
        {
          host: env.MINECRAFT_RCON_HOST,
          port: env.MINECRAFT_RCON_PORT,
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
      const updatedKeys = new Set<string>();

      // Update existing properties in place, preserving comments and layout.
      const newLines = content.split(/\r?\n/).map((line) => {
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
      while (newLines.length > 0 && newLines[newLines.length - 1] === "") {
        newLines.pop();
      }

      // Append properties that weren't in the file yet.
      for (const [key, value] of Object.entries(properties)) {
        if (!updatedKeys.has(key)) {
          newLines.push(`${key}=${value}`);
        }
      }

      // The server only reads server.properties on startup; changes apply after a restart.
      await fs.writeFile(filePath, newLines.join("\n") + "\n", "utf-8");
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
