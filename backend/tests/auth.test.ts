import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

interface StoredUser {
  _id: string;
  email: string;
  password: string;
  role: "admin" | "user";
  refreshToken?: string;
}

// In-memory stand-in for the Mongo-backed repository so these tests need no database.
const store = vi.hoisted(() => ({ users: new Map<string, StoredUser>(), nextId: 1 }));

vi.mock("../src/repositories/UserRepository", () => {
  const byEmail = (email: string) => [...store.users.values()].find((u) => u.email === email) ?? null;
  return {
    UserRepository: {
      create: async (data: { email: string; password: string; role?: "admin" | "user" }) => {
        const user: StoredUser = {
          _id: String(store.nextId++),
          email: data.email.toLowerCase(),
          password: data.password,
          role: data.role ?? "user",
        };
        store.users.set(user._id, user);
        return { ...user };
      },
      findByEmail: async (email: string) => {
        const user = byEmail(email.toLowerCase());
        return user ? { ...user } : null;
      },
      findById: async (id: string) => {
        const user = store.users.get(id);
        return user ? { ...user, refreshToken: undefined } : null;
      },
      findByIdWithRefreshToken: async (id: string) => {
        const user = store.users.get(id);
        return user ? { ...user } : null;
      },
      updateRefreshToken: async (id: string, refreshToken: string) => {
        store.users.get(id)!.refreshToken = refreshToken;
      },
      clearRefreshToken: async (id: string) => {
        delete store.users.get(id)!.refreshToken;
      },
      setCredentials: async (id: string, data: { password: string; role: "admin" | "user" }) => {
        Object.assign(store.users.get(id)!, data);
      },
    },
  };
});

import app from "../src/app";
import { AuthService } from "../src/services/AuthService";

const ADMIN = { email: "admin@example.com", password: "test-admin-password" };
const USER = { email: "user@example.com", password: "user-password-123" };

const login = (creds: { email: string; password: string }) =>
  request(app).post("/api/auth/login").send(creds);

const adminToken = async (): Promise<string> => (await login(ADMIN)).body.data.accessToken;

describe("auth", () => {
  beforeEach(async () => {
    store.users.clear();
    store.nextId = 1;
    await AuthService.ensureSuperAdmin();
  });

  describe("super admin seeding", () => {
    it("creates the admin from env so it can log in", async () => {
      const res = await login(ADMIN);
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe("admin");
    });

    it("re-syncs password and role when they drift from env", async () => {
      const admin = [...store.users.values()][0];
      admin.role = "user";
      admin.password = "not-a-hash";
      await AuthService.ensureSuperAdmin();
      expect((await login(ADMIN)).status).toBe(200);
      expect(store.users.get(admin._id)!.role).toBe("admin");
    });
  });

  describe("POST /api/auth/register", () => {
    it("rejects unauthenticated callers", async () => {
      const res = await request(app).post("/api/auth/register").send(USER);
      expect(res.status).toBe(401);
    });

    it("rejects non-admin users", async () => {
      const token = await adminToken();
      await request(app).post("/api/auth/register").set("Authorization", `Bearer ${token}`).send(USER);
      const userToken = (await login(USER)).body.data.accessToken;

      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ email: "other@example.com", password: "another-password" });
      expect(res.status).toBe(403);
    });

    it("lets the super admin create a regular user (without issuing tokens)", async () => {
      const token = await adminToken();
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send(USER);
      expect(res.status).toBe(201);
      expect(res.body.data.user).toMatchObject({ email: USER.email, role: "user" });
      expect(res.body.data.accessToken).toBeUndefined();
    });

    it("returns 409 for a duplicate email", async () => {
      const token = await adminToken();
      const send = () =>
        request(app).post("/api/auth/register").set("Authorization", `Bearer ${token}`).send(USER);
      await send();
      expect((await send()).status).toBe(409);
    });
  });

  describe("login", () => {
    it("rejects a wrong password and an unknown email identically", async () => {
      const wrong = await login({ ...ADMIN, password: "wrong-password" });
      const unknown = await login({ email: "nobody@example.com", password: "whatever-123" });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
    });
  });

  describe("refresh tokens", () => {
    it("rotates the refresh token and rejects the superseded one", async () => {
      const first = (await login(ADMIN)).body.data;

      const rotated = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: first.refreshToken });
      expect(rotated.status).toBe(200);
      expect(rotated.body.data.refreshToken).not.toBe(first.refreshToken);

      // Replaying the old token fails and revokes the whole session.
      const replay = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: first.refreshToken });
      expect(replay.status).toBe(401);

      const afterReplay = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: rotated.body.data.refreshToken });
      expect(afterReplay.status).toBe(401);
    });

    it("rejects garbage tokens with 401 (not 500)", async () => {
      const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "nope" });
      expect(res.status).toBe(401);
    });

    it("cannot be used after logout", async () => {
      const { accessToken, refreshToken } = (await login(ADMIN)).body.data;

      const out = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(out.status).toBe(200);

      const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
      expect(res.status).toBe(401);
    });
  });
});
