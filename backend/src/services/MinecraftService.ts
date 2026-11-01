import { promises as fs } from "fs";
import docker from "../utils/docker";
import { sendRconCommand } from "../utils/rcon";
import { env } from "../config/env";

const STOP_TIMEOUT_SECONDS = 30;

export const MinecraftService = {
  async start(): Promise<{ container: string }> {
    const container = docker.getContainer(env.MINECRAFT_CONTAINER_NAME);
    await container.start();
    return { container: env.MINECRAFT_CONTAINER_NAME };
  },
  async stop(): Promise<{ container: string }> {
    const container = docker.getContainer(env.MINECRAFT_CONTAINER_NAME);
    await container.stop({ t: STOP_TIMEOUT_SECONDS });
    return { container: env.MINECRAFT_CONTAINER_NAME };
  },
  async getLogs(tail: number): Promise<string> {
    const container = docker.getContainer(env.MINECRAFT_CONTAINER_NAME);
    const buffer = await container.logs({ stdout: true, stderr: true, follow: false, tail });
    return buffer.toString("utf-8");
  },
  async sendCommand(command: string): Promise<string> {
    return sendRconCommand(
      { host: env.MINECRAFT_RCON_HOST, port: env.MINECRAFT_RCON_PORT, password: env.MINECRAFT_RCON_PASSWORD },
      command,
    );
  },
  async updateProperties(properties: Record<string, string>): Promise<{ restarted: boolean }> {
    const filePath = `${env.MINECRAFT_DATA_DIR}/server.properties`;
    const content = await fs.readFile(filePath, "utf-8");
    const current = new Map<string, string>();
    for (const line of content.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq > -1) {
        current.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
      }
    }
    const updated: Record<string, string> = { ...Object.fromEntries(current), ...properties };
    const newContent = Object.entries(updated)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";
    await fs.writeFile(filePath, newContent, "utf-8");
    await this.start();
    return { restarted: true };
  },
};
