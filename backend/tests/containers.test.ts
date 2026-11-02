import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const users = vi.hoisted(() => ({
  "1": { _id: "1", email: "admin@example.com", role: "admin" },
  "2": { _id: "2", email: "user@example.com", role: "user" },
}));

const docker = vi.hoisted(() => {
  const container = { inspect: vi.fn(), logs: vi.fn() };
  return { container, listContainers: vi.fn(), getContainer: vi.fn(() => container) };
});

vi.mock("../src/repositories/UserRepository", () => ({
  UserRepository: { findById: async (id: string) => users[id as "1" | "2"] ?? null },
}));

vi.mock("../src/utils/docker", () => ({
  default: { listContainers: docker.listContainers, getContainer: docker.getContainer },
}));

import app from "../src/app";
import { signAccessToken } from "../src/utils/tokens";

const adminAuth = { Authorization: `Bearer ${signAccessToken({ sub: "1", email: "admin@example.com" })}` };
const userAuth = { Authorization: `Bearer ${signAccessToken({ sub: "2", email: "user@example.com" })}` };

const STACK = [
  {
    Id: "c-web",
    Names: ["/backend-web-1"],
    Image: "backend-web",
    State: "running",
    Status: "Up 5 minutes",
    Labels: { "com.docker.compose.service": "web" },
  },
  {
    Id: "c-api",
    Names: ["/backend-api-1"],
    Image: "backend-api",
    State: "running",
    Status: "Up 5 minutes",
    Labels: { "com.docker.compose.service": "api" },
  },
  {
    Id: "c-mc",
    Names: ["/minecraft-server"],
    Image: "itzg/minecraft-server:latest",
    State: "exited",
    Status: "Exited (0) 2 hours ago",
    Labels: { "com.docker.compose.service": "minecraft" },
  },
];

const frame = (text: string): Buffer => {
  const payload = Buffer.from(text);
  const header = Buffer.alloc(8);
  header[0] = 1;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
};

describe("admin container logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docker.listContainers.mockResolvedValue(STACK);
    docker.container.inspect.mockResolvedValue({ Config: { Tty: false } });
  });

  it("is super-admin only", async () => {
    expect((await request(app).get("/api/admin/containers").set(userAuth)).status).toBe(403);
    expect(
      (await request(app).get("/api/admin/containers/backend-api-1/logs").set(userAuth)).status,
    ).toBe(403);
    expect((await request(app).get("/api/admin/containers")).status).toBe(401);
  });

  it("lists only this compose project's containers, sorted by service", async () => {
    const res = await request(app).get("/api/admin/containers").set(adminAuth);
    expect(res.status).toBe(200);
    expect(docker.listContainers).toHaveBeenCalledWith({
      all: true,
      filters: { label: ["com.docker.compose.project=backend"] },
    });
    expect(res.body.data.containers.map((c: { service: string }) => c.service)).toEqual([
      "api",
      "minecraft",
      "web",
    ]);
    expect(res.body.data.containers[0]).toEqual({
      name: "backend-api-1",
      service: "api",
      image: "backend-api",
      state: "running",
      status: "Up 5 minutes",
    });
  });

  it("returns a container's demultiplexed logs with the requested options", async () => {
    docker.container.logs.mockResolvedValue(
      Buffer.concat([frame('{"level":30,"msg":"Server started"}\n'), frame("stderr line\n")]),
    );
    const res = await request(app)
      .get("/api/admin/containers/backend-api-1/logs?tail=100&timestamps=true")
      .set(adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      container: "backend-api-1",
      logs: '{"level":30,"msg":"Server started"}\nstderr line\n',
    });
    expect(docker.getContainer).toHaveBeenCalledWith("backend-api-1");
    expect(docker.container.logs).toHaveBeenCalledWith(
      expect.objectContaining({ tail: 100, timestamps: true, stdout: true, stderr: true }),
    );
  });

  it("defaults to the last 500 lines without timestamps", async () => {
    docker.container.logs.mockResolvedValue(Buffer.alloc(0));
    await request(app).get("/api/admin/containers/backend-web-1/logs").set(adminAuth);
    expect(docker.container.logs).toHaveBeenCalledWith(
      expect.objectContaining({ tail: 500, timestamps: false }),
    );
  });

  it("refuses containers outside the stack without touching them", async () => {
    const res = await request(app).get("/api/admin/containers/some-other-app/logs").set(adminAuth);
    expect(res.status).toBe(404);
    expect(docker.getContainer).not.toHaveBeenCalled();
  });

  it("validates the name and tail", async () => {
    expect(
      (await request(app).get("/api/admin/containers/..%2Fetc/logs").set(adminAuth)).status,
    ).toBe(422);
    expect(
      (await request(app).get("/api/admin/containers/backend-api-1/logs?tail=99999").set(adminAuth))
        .status,
    ).toBe(422);
  });

  it("reports an unreachable Docker daemon as 502", async () => {
    docker.listContainers.mockRejectedValue(
      Object.assign(new Error("connect ENOENT /var/run/docker.sock"), { code: "ENOENT" }),
    );
    const res = await request(app).get("/api/admin/containers").set(adminAuth);
    expect(res.status).toBe(502);
    expect(res.body.error.details).toMatchObject({ code: "ENOENT" });
  });
});
