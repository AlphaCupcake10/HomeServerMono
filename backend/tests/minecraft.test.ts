import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const docker = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  inspect: vi.fn(),
  logs: vi.fn(),
}));

const rcon = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("../src/utils/docker", () => ({
  default: { getContainer: () => docker },
}));

vi.mock("../src/utils/rcon", () => ({ sendRconCommand: rcon.send }));

vi.mock("../src/repositories/UserRepository", () => ({
  UserRepository: {
    findById: async (id: string) => ({ _id: id, email: "user@example.com", role: "user" }),
  },
}));

import app from "../src/app";
import { config } from "../src/config/config";
import { signAccessToken } from "../src/utils/tokens";

const propertiesFile = path.join(config.minecraft.dataDir, "server.properties");
const token = signAccessToken({ sub: "1", email: "user@example.com" });
const auth = { Authorization: `Bearer ${token}` };

const frame = (text: string): Buffer => {
  const payload = Buffer.from(text);
  const header = Buffer.alloc(8);
  header[0] = 1;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
};

describe("minecraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(path.dirname(propertiesFile), { recursive: true });
    fs.writeFileSync(
      propertiesFile,
      "#Minecraft server properties\nmotd=Hello\nrcon.password=super-secret\nenable-rcon=true\n",
    );
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/minecraft/properties")).status).toBe(401);
    expect((await request(app).post("/api/minecraft/commands").send({ command: "list" })).status).toBe(401);
  });

  describe("properties", () => {
    it("never returns the RCON password", async () => {
      const res = await request(app).get("/api/minecraft/properties").set(auth);
      expect(res.status).toBe(200);
      expect(res.body.data.motd).toBe("Hello");
      expect(res.body.data).not.toHaveProperty("rcon.password");
      expect(JSON.stringify(res.body)).not.toContain("super-secret");
    });

    it("rejects values containing line breaks (property injection)", async () => {
      const res = await request(app)
        .put("/api/minecraft/properties")
        .set(auth)
        .send({ properties: { motd: "hi\nenable-command-block=true" } });
      expect(res.status).toBe(422);
      expect(fs.readFileSync(propertiesFile, "utf-8")).not.toContain("enable-command-block");
    });

    it("rejects changes to RCON settings", async () => {
      const res = await request(app)
        .put("/api/minecraft/properties")
        .set(auth)
        .send({ properties: { "rcon.password": "x" } });
      expect(res.status).toBe(422);
      expect(fs.readFileSync(propertiesFile, "utf-8")).toContain("rcon.password=super-secret");
    });

    it("updates in place, appends new keys and doesn't grow the file on repeat", async () => {
      const body = { properties: { motd: "Welcome", difficulty: "hard" } };
      expect((await request(app).put("/api/minecraft/properties").set(auth).send(body)).status).toBe(200);
      const once = fs.readFileSync(propertiesFile, "utf-8");
      expect(once).toContain("#Minecraft server properties");
      expect(once).toContain("motd=Welcome");
      expect(once).toContain("difficulty=hard");
      expect(once).not.toContain("motd=Hello");

      await request(app).put("/api/minecraft/properties").set(auth).send(body);
      expect(fs.readFileSync(propertiesFile, "utf-8")).toBe(once);
    });

    it("ignores prototype keys when matching existing lines", async () => {
      fs.appendFileSync(propertiesFile, "constructor=keep\n");
      await request(app)
        .put("/api/minecraft/properties")
        .set(auth)
        .send({ properties: { motd: "x" } });
      expect(fs.readFileSync(propertiesFile, "utf-8")).toContain("constructor=keep");
    });
  });

  describe("logs", () => {
    it("applies the default tail and decodes Docker's multiplexed frames", async () => {
      docker.inspect.mockResolvedValue({ Config: { Tty: false } });
      docker.logs.mockResolvedValue(Buffer.concat([frame("line one\n"), frame("line two\n")]));

      const res = await request(app).get("/api/minecraft/logs").set(auth);
      expect(res.status).toBe(200);
      expect(res.body.data.logs).toBe("line one\nline two\n");
      expect(docker.logs).toHaveBeenCalledWith(expect.objectContaining({ tail: 50 }));
    });

    it("validates the tail query", async () => {
      expect((await request(app).get("/api/minecraft/logs?tail=100000").set(auth)).status).toBe(422);
    });

    it("returns raw output for TTY containers", async () => {
      docker.inspect.mockResolvedValue({ Config: { Tty: true } });
      docker.logs.mockResolvedValue(Buffer.from("raw output"));
      const res = await request(app).get("/api/minecraft/logs?tail=5").set(auth);
      expect(res.body.data.logs).toBe("raw output");
      expect(docker.logs).toHaveBeenCalledWith(expect.objectContaining({ tail: 5 }));
    });
  });

  describe("commands", () => {
    it("returns the RCON response", async () => {
      rcon.send.mockResolvedValue("There are 0 of a max of 20 players online");
      const res = await request(app).post("/api/minecraft/commands").set(auth).send({ command: "list" });
      expect(res.status).toBe(200);
      expect(res.body.data.response).toContain("0 of a max");
    });

    it("explains that the server may be stopped when RCON is unreachable", async () => {
      rcon.send.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
      const res = await request(app).post("/api/minecraft/commands").set(auth).send({ command: "list" });
      expect(res.status).toBe(503);
      expect(res.body.error.message).toContain("stopped");
      expect(res.body.error.details).toMatchObject({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" });
    });
  });

  describe("unexpected errors", () => {
    it("include the underlying error in the 500 response", async () => {
      docker.inspect.mockRejectedValue(new TypeError("something exploded"));
      const res = await request(app).get("/api/minecraft/logs").set(auth);
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe("Internal server error");
      expect(res.body.error.details).toMatchObject({ name: "TypeError", message: "something exploded" });
    });
  });

  it("returns 404 when updating properties before server.properties exists", async () => {
    fs.rmSync(propertiesFile, { force: true });
    const res = await request(app)
      .put("/api/minecraft/properties")
      .set(auth)
      .send({ properties: { motd: "x" } });
    expect(res.status).toBe(404);
  });

  describe("start / stop", () => {
    it("maps 'already started' (HTTP 304) to 409", async () => {
      docker.start.mockRejectedValue(Object.assign(new Error("already started"), { statusCode: 304 }));
      expect((await request(app).post("/api/minecraft/start").set(auth)).status).toBe(409);
    });

    it("maps a missing container to 404 with a hint and the underlying error", async () => {
      docker.stop.mockRejectedValue(Object.assign(new Error("no such container"), { statusCode: 404 }));
      const res = await request(app).post("/api/minecraft/stop").set(auth);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain("make minecraft-create");
      expect(res.body.error.details).toMatchObject({ message: "no such container" });
    });

    it("reports an unreachable Docker daemon as 502 with details", async () => {
      docker.start.mockRejectedValue(
        Object.assign(new Error("connect ENOENT /var/run/docker.sock"), { code: "ENOENT" }),
      );
      const res = await request(app).post("/api/minecraft/start").set(auth);
      expect(res.status).toBe(502);
      expect(res.body.error.details).toMatchObject({ code: "ENOENT" });
    });

    it("starts the container", async () => {
      docker.start.mockResolvedValue(undefined);
      const res = await request(app).post("/api/minecraft/start").set(auth);
      expect(res.status).toBe(200);
    });

    it("re-syncs a stale rcon.password from env before starting", async () => {
      // beforeEach wrote rcon.password=super-secret; env says MINECRAFT_RCON_PASSWORD=test.
      fs.appendFileSync(propertiesFile, "motd-extra=keep\n");
      docker.start.mockResolvedValue(undefined);

      expect((await request(app).post("/api/minecraft/start").set(auth)).status).toBe(200);

      const content = fs.readFileSync(propertiesFile, "utf-8");
      expect(content).toContain(`rcon.password=${process.env.MINECRAFT_RCON_PASSWORD}`);
      expect(content).not.toContain("super-secret");
      expect(content).toContain("motd=Hello");
      expect(content).toContain("motd-extra=keep");
    });

    it("still starts when server.properties doesn't exist yet", async () => {
      fs.rmSync(propertiesFile, { force: true });
      docker.start.mockResolvedValue(undefined);
      expect((await request(app).post("/api/minecraft/start").set(auth)).status).toBe(200);
      expect(fs.existsSync(propertiesFile)).toBe(false);
    });
  });
});
