import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const users = vi.hoisted(() => ({
  "1": { _id: "1", email: "admin@example.com", role: "admin" },
  "2": { _id: "2", email: "user@example.com", role: "user" },
}));

// In-memory stand-ins for MongoDB.
const db = vi.hoisted(() => ({
  setting: null as null | { values: Record<string, unknown>; updatedBy: unknown; updatedAt: Date },
  audit: [] as Array<Record<string, unknown>>,
}));

const docker = vi.hoisted(() => ({ inspect: vi.fn() }));
const rcon = vi.hoisted(() => ({ send: vi.fn() }));
const auditCreate = vi.hoisted(() => vi.fn());

vi.mock("../src/repositories/UserRepository", () => ({
  UserRepository: { findById: async (id: string) => users[id as "1" | "2"] ?? null },
}));

vi.mock("../src/repositories/SettingsRepository", () => ({
  SettingsRepository: {
    get: async () => db.setting,
    save: async (_id: string, values: Record<string, unknown>, updatedBy: unknown) => {
      db.setting = { values: structuredClone(values), updatedBy, updatedAt: new Date() };
      return db.setting;
    },
  },
}));

vi.mock("../src/repositories/AuditRepository", () => ({
  AuditRepository: {
    isAvailable: () => true,
    create: auditCreate,
    latest: async (limit: number) =>
      [...db.audit]
        .reverse()
        .slice(0, limit)
        .map((entry, i) => ({ _id: `a${i}`, ...entry })),
  },
}));

vi.mock("../src/utils/docker", () => ({ default: { getContainer: () => docker } }));
vi.mock("../src/utils/rcon", () => ({ sendRconCommand: rcon.send }));

import app from "../src/app";
import { config } from "../src/config/config";
import { runtimeSettings } from "../src/config/runtimeSettings";
import { SettingsService } from "../src/services/SettingsService";
import { logger } from "../src/utils/logger";
import { signAccessToken } from "../src/utils/tokens";

const adminAuth = { Authorization: `Bearer ${signAccessToken({ sub: "1", email: "admin@example.com" })}` };
const userAuth = { Authorization: `Bearer ${signAccessToken({ sub: "2", email: "user@example.com" })}` };

const putSettings = (body: unknown, auth = adminAuth) =>
  request(app).put("/api/admin/settings").set(auth).send(body as object);

describe("runtime settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.setting = null;
    db.audit = [];
    auditCreate.mockImplementation(async (entry: Record<string, unknown>) => {
      db.audit.push(entry);
      return entry;
    });
    runtimeSettings.set(structuredClone(config.runtimeDefaults));
    logger.level = config.runtimeDefaults.logLevel;
  });

  describe("SettingsService.init", () => {
    it("overlays stored values on the YAML defaults and drops unknown keys", async () => {
      db.setting = {
        values: { logLevel: "warn", rateLimit: { max: 50 }, retired: true },
        updatedBy: { id: "1", email: "admin@example.com" },
        updatedAt: new Date(),
      };
      await SettingsService.init();

      const settings = SettingsService.get();
      expect(settings.logLevel).toBe("warn");
      expect(settings.rateLimit).toEqual({ max: 50, authMax: 10 });
      expect(settings.features.minecraft.enabled).toBe(true);
      expect(settings).not.toHaveProperty("retired");
      expect(logger.level).toBe("warn");
    });

    it("falls back to the defaults when the stored document is invalid", async () => {
      db.setting = { values: { logLevel: "loud" }, updatedBy: null, updatedAt: new Date() };
      await SettingsService.init();
      expect(SettingsService.get()).toEqual(config.runtimeDefaults);
    });
  });

  describe("GET /api/config", () => {
    it("returns the feature flags to any signed-in user", async () => {
      const res = await request(app).get("/api/config").set(userAuth);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ features: { minecraft: { enabled: true } } });
    });

    it("requires authentication", async () => {
      expect((await request(app).get("/api/config")).status).toBe(401);
    });
  });

  describe("/api/admin/settings", () => {
    it("is super-admin only", async () => {
      expect((await request(app).get("/api/admin/settings").set(userAuth)).status).toBe(403);
      expect((await putSettings({ logLevel: "debug" }, userAuth)).status).toBe(403);
      expect((await request(app).get("/api/admin/audit").set(userAuth)).status).toBe(403);
    });

    it("returns values, defaults and the YAML config without secrets", async () => {
      const res = await request(app).get("/api/admin/settings").set(adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.values).toEqual(config.runtimeDefaults);
      expect(res.body.data.defaults).toEqual(config.runtimeDefaults);
      expect(res.body.data.deployment.minecraft.containerName).toBe(config.minecraft.containerName);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(process.env.JWT_SECRET!);
      expect(body).not.toContain(process.env.SUPER_ADMIN_PASSWORD!);
    });

    it("rejects unknown keys, invalid values and empty updates with 422", async () => {
      expect((await putSettings({ colour: "blue" })).status).toBe(422);
      expect((await putSettings({ logLevel: "loud" })).status).toBe(422);
      expect((await putSettings({ rateLimit: { max: 0 } })).status).toBe(422);
      expect((await putSettings({ features: { chess: { enabled: true } } })).status).toBe(422);
      expect((await putSettings({})).status).toBe(422);
      expect(db.setting).toBeNull();
    });

    it("persists, applies the log level live and records who changed what", async () => {
      const res = await putSettings({ logLevel: "debug" });
      expect(res.status).toBe(200);
      expect(res.body.data.values.logLevel).toBe("debug");
      expect(res.body.data.updatedBy).toEqual({ id: "1", email: "admin@example.com" });
      expect(logger.level).toBe("debug");
      expect(db.setting?.values.logLevel).toBe("debug");

      expect(db.audit).toHaveLength(1);
      expect(db.audit[0]).toMatchObject({
        actor: { id: "1", email: "admin@example.com" },
        action: "settings.update",
        details: { changes: { logLevel: { from: "info", to: "debug" } } },
      });
    });

    it("does nothing when the update changes nothing", async () => {
      const res = await putSettings({ logLevel: "info" });
      expect(res.status).toBe(200);
      expect(db.setting).toBeNull();
      expect(db.audit).toHaveLength(0);
    });

    it("applies exposeErrorDetails live", async () => {
      docker.inspect.mockRejectedValue(new TypeError("boom"));
      const before = await request(app).get("/api/minecraft/status").set(adminAuth);
      expect(before.body.error.details).toMatchObject({ message: "boom" });

      await putSettings({ exposeErrorDetails: false });
      const after = await request(app).get("/api/minecraft/status").set(adminAuth);
      expect(after.status).toBe(500);
      expect(after.body.error.details).toBeUndefined();
    });
  });

  describe("feature flag", () => {
    it("disabling Minecraft hides it from /config and blocks its API with FEATURE_DISABLED", async () => {
      docker.inspect.mockResolvedValue({ State: { Status: "running", Running: true } });
      expect((await request(app).get("/api/minecraft/status").set(userAuth)).status).toBe(200);

      expect((await putSettings({ features: { minecraft: { enabled: false } } })).status).toBe(200);

      const cfg = await request(app).get("/api/config").set(userAuth);
      expect(cfg.body.data.features.minecraft.enabled).toBe(false);

      const blocked = await request(app).get("/api/minecraft/status").set(userAuth);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toMatchObject({ code: "FEATURE_DISABLED", details: { feature: "minecraft" } });
      expect(db.audit[0]).toMatchObject({
        details: { changes: { "features.minecraft.enabled": { from: true, to: false } } },
      });

      await putSettings({ features: { minecraft: { enabled: true } } });
      expect((await request(app).get("/api/minecraft/status").set(userAuth)).status).toBe(200);
    });

    it("still answers 401 (not the feature state) to anonymous callers", async () => {
      runtimeSettings.set({ ...config.runtimeDefaults, features: { minecraft: { enabled: false } } });
      expect((await request(app).get("/api/minecraft/status")).status).toBe(401);
    });
  });

  describe("audit log", () => {
    it("records Minecraft commands with the actor", async () => {
      rcon.send.mockResolvedValue("ok");
      await request(app).post("/api/minecraft/commands").set(userAuth).send({ command: "list" });
      expect(db.audit[0]).toMatchObject({
        actor: { id: "2", email: "user@example.com" },
        action: "minecraft.command",
        details: { command: "list" },
      });
    });

    it("never fails the request when the audit write fails", async () => {
      auditCreate.mockRejectedValue(new Error("db down"));
      rcon.send.mockResolvedValue("ok");
      const res = await request(app).post("/api/minecraft/commands").set(userAuth).send({ command: "list" });
      expect(res.status).toBe(200);
    });

    it("lists the latest entries newest first, honouring the limit", async () => {
      await putSettings({ logLevel: "debug" });
      await putSettings({ logLevel: "warn" });
      const res = await request(app).get("/api/admin/audit?limit=1").set(adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.entries).toHaveLength(1);
      expect(res.body.data.entries[0].details.changes.logLevel.to).toBe("warn");
      expect((await request(app).get("/api/admin/audit?limit=500").set(adminAuth)).status).toBe(422);
    });
  });

  describe("GET /api/minecraft/status", () => {
    it("maps a running container", async () => {
      docker.inspect.mockResolvedValue({
        State: {
          Status: "running",
          Running: true,
          StartedAt: "2026-11-02T15:00:00Z",
          FinishedAt: "0001-01-01T00:00:00Z",
          ExitCode: 0,
          Health: { Status: "healthy" },
        },
      });
      const res = await request(app).get("/api/minecraft/status").set(userAuth);
      expect(res.body.data).toEqual({
        container: config.minecraft.containerName,
        state: "running",
        running: true,
        startedAt: "2026-11-02T15:00:00Z",
        finishedAt: null,
        exitCode: null,
        health: "healthy",
      });
    });

    it("maps a stopped container with its exit code", async () => {
      docker.inspect.mockResolvedValue({
        State: { Status: "exited", Running: false, StartedAt: "a", FinishedAt: "b", ExitCode: 137 },
      });
      const res = await request(app).get("/api/minecraft/status").set(userAuth);
      expect(res.body.data).toMatchObject({ state: "exited", running: false, exitCode: 137, health: null });
    });

    it("reports a missing container as state 'missing' instead of an error", async () => {
      docker.inspect.mockRejectedValue(Object.assign(new Error("no such container"), { statusCode: 404 }));
      const res = await request(app).get("/api/minecraft/status").set(userAuth);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ state: "missing", running: false });
    });
  });

  // Last: the rate-limit store is shared across this file's requests.
  it("applies rate-limit changes immediately to anonymous requests", async () => {
    expect((await putSettings({ rateLimit: { max: 1 } })).status).toBe(200);
    expect((await request(app).get("/api/config")).status).toBe(429);

    await SettingsService.update({ rateLimit: { max: 1000 } }, { id: "1", email: "admin@example.com" });
    expect((await request(app).get("/api/config")).status).toBe(401);
  });

  it("never throttles signed-in users (the UI polls), but does throttle forged tokens", async () => {
    runtimeSettings.set({ ...config.runtimeDefaults, rateLimit: { max: 1, authMax: 10 } });
    for (let i = 0; i < 5; i++) {
      expect((await request(app).get("/api/config").set(userAuth)).status).toBe(200);
    }
    const forged = { Authorization: "Bearer not-a-real-token" };
    expect((await request(app).get("/api/config").set(forged)).status).toBe(429);
  });
});
