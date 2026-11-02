import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/config";

const BASE = `
database:
  uri: mongodb://localhost:27017/base
auth:
  superAdminEmail: admin@example.com
server:
  corsOrigins: [http://a.example.com, http://b.example.com]
minecraft:
  containerName: mc
  dataDir: ../data/minecraft
  rcon:
    host: 127.0.0.1
`;

let rootDir: string;

const writeConfig = (name: string, content: string): void => {
  fs.writeFileSync(path.join(rootDir, "config", name), content);
};

describe("loadConfig", () => {
  // tests/setup.ts points CONFIG_OVERLAY at the suite-wide overlay; keep it out of these cases.
  const suiteOverlay = process.env.CONFIG_OVERLAY;

  beforeEach(() => {
    delete process.env.CONFIG_OVERLAY;
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    fs.mkdirSync(path.join(rootDir, "config"));
    writeConfig("config.yaml", BASE);
  });

  afterEach(() => {
    process.env.CONFIG_OVERLAY = suiteOverlay;
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("loads the base file and fills in defaults", () => {
    const config = loadConfig({ rootDir, nodeEnv: "development" });
    expect(config.database.uri).toBe("mongodb://localhost:27017/base");
    expect(config.server.port).toBe(3000);
    expect(config.rateLimit).toEqual({ windowMs: 900000, max: 100, authMax: 10 });
    expect(config.log.level).toBe("info");
    expect(config.minecraft.rcon.port).toBe(25575);
  });

  it("resolves a relative dataDir against the root folder", () => {
    const config = loadConfig({ rootDir, nodeEnv: "development" });
    expect(config.minecraft.dataDir).toBe(path.resolve(rootDir, "../data/minecraft"));
  });

  it("merges overlay then local on top of base, keeping untouched siblings", () => {
    writeConfig("overlay.yaml", "minecraft:\n  rcon:\n    host: minecraft\n");
    writeConfig("config.local.yaml", "database:\n  uri: mongodb://local/db\nminecraft:\n  rcon:\n    host: from-local\n");

    const config = loadConfig({ rootDir, overlay: "config/overlay.yaml", includeLocal: true });

    expect(config.minecraft.rcon.host).toBe("from-local");
    expect(config.minecraft.containerName).toBe("mc");
    expect(config.database.uri).toBe("mongodb://local/db");
  });

  it("replaces arrays instead of concatenating them", () => {
    writeConfig("config.local.yaml", "server:\n  corsOrigins: [http://c.example.com]\n");
    const config = loadConfig({ rootDir, includeLocal: true });
    expect(config.server.corsOrigins).toEqual(["http://c.example.com"]);
  });

  it("skips config.local.yaml under tests by default", () => {
    writeConfig("config.local.yaml", "database:\n  uri: mongodb://local/db\n");
    expect(loadConfig({ rootDir, nodeEnv: "test" }).database.uri).toBe("mongodb://localhost:27017/base");
  });

  it("rejects unknown keys and names the loaded files", () => {
    writeConfig("config.local.yaml", "server:\n  prot: 4000\n");
    expect(() => loadConfig({ rootDir, includeLocal: true })).toThrow(
      /Invalid configuration \(loaded config[\\/]config\.yaml, config[\\/]config\.local\.yaml\).*server\.prot/,
    );
  });

  it("rejects values of the wrong type", () => {
    writeConfig("config.local.yaml", "server:\n  port: not-a-port\n");
    expect(() => loadConfig({ rootDir, includeLocal: true })).toThrow(/server\.port/);
  });

  it("fails when required settings are missing", () => {
    writeConfig("config.yaml", "database:\n  uri: x\n");
    expect(() => loadConfig({ rootDir, includeLocal: false })).toThrow(/auth.*required|minecraft.*required/);
  });

  it("fails when the overlay file doesn't exist", () => {
    expect(() => loadConfig({ rootDir, overlay: "config/missing.yaml" })).toThrow(
      /CONFIG_OVERLAY file not found/,
    );
  });

  it("fails when config.yaml doesn't exist", () => {
    fs.rmSync(path.join(rootDir, "config", "config.yaml"));
    expect(() => loadConfig({ rootDir })).toThrow(/Config file not found/);
  });

  it("defaults exposeErrorDetails to on outside production, off in production", () => {
    expect(loadConfig({ rootDir, nodeEnv: "development" }).server.exposeErrorDetails).toBe(true);
    expect(loadConfig({ rootDir, nodeEnv: "production" }).server.exposeErrorDetails).toBe(false);

    writeConfig("config.local.yaml", "server:\n  exposeErrorDetails: true\n");
    const explicit = loadConfig({ rootDir, nodeEnv: "production", includeLocal: true });
    expect(explicit.server.exposeErrorDetails).toBe(true);
  });

  it("ignores prototype-polluting keys", () => {
    writeConfig("config.local.yaml", "__proto__:\n  polluted: true\n");
    loadConfig({ rootDir, includeLocal: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("shipped config files", () => {
  const backendDir = path.resolve(__dirname, "..");

  it("config.yaml is valid on its own (local dev)", () => {
    const config = loadConfig({ rootDir: backendDir, overlay: "", includeLocal: false });
    expect(config.database.uri).toContain("localhost");
    expect(config.minecraft.dataDir).toBe(path.resolve(backendDir, "../modules/minecraft-server"));
  });

  it("config.docker.yaml points at the compose services", () => {
    const config = loadConfig({
      rootDir: backendDir,
      overlay: "config/config.docker.yaml",
      includeLocal: false,
    });
    expect(config.database.uri).toBe("mongodb://mongo:27017/home_server_mono");
    expect(config.minecraft.rcon.host).toBe("minecraft");
    // Absolute already; path.resolve only adds a drive letter when tests run on Windows.
    expect(config.minecraft.dataDir).toBe(path.resolve("/srv/minecraft"));
  });

  it("config.local.example.yaml parses (all commented out)", () => {
    const example = path.join(backendDir, "config", "config.local.example.yaml");
    const config = loadConfig({ rootDir: backendDir, overlay: example, includeLocal: false });
    expect(config.server.port).toBe(3000);
  });
});
