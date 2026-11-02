import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

interface StoredUser {
  _id: string;
  email: string;
  password: string;
  role: "admin" | "user";
}

interface StoredSession {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
}

// In-memory stand-ins for the Mongo-backed repositories so these tests need no database.
const store = vi.hoisted(() => ({
  users: new Map<string, StoredUser>(),
  sessions: new Map<string, StoredSession>(),
  nextId: 1,
  nextSessionId: 1,
}));

vi.mock("../src/repositories/SessionRepository", () => ({
  SessionRepository: {
    newId: () => `s${store.nextSessionId++}`,
    create: async (data: Omit<StoredSession, "_id"> & { id: string }) => {
      const { id, ...rest } = data;
      store.sessions.set(id, { _id: id, ...rest });
    },
    findById: async (id: string) => {
      const session = store.sessions.get(id);
      return session ? { ...session } : null;
    },
    rotate: async (id: string, tokenHash: string, expiresAt: Date) => {
      const session = store.sessions.get(id);
      if (session) Object.assign(session, { tokenHash, expiresAt });
    },
    delete: async (id: string, userId: string) => {
      if (store.sessions.get(id)?.userId === userId) store.sessions.delete(id);
    },
    deleteAllForUser: async (userId: string) => {
      for (const [id, session] of store.sessions) {
        if (session.userId === userId) store.sessions.delete(id);
      }
    },
  },
}));

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
        return user ? { ...user } : null;
      },
      setCredentials: async (id: string, data: { password: string; role: "admin" | "user" }) => {
        Object.assign(store.users.get(id)!, data);
      },
    },
  };
});

import app from "../src/app";
import { config } from "../src/config/config";
import { runtimeSettings } from "../src/config/runtimeSettings";
import { AuthService } from "../src/services/AuthService";

const ADMIN = { email: "admin@example.com", password: "test-admin-password" };
const USER = { email: "user@example.com", password: "user-password-123" };

const login = (creds: { email: string; password: string }) =>
  request(app).post("/api/auth/login").send(creds);

const adminToken = async (): Promise<string> => (await login(ADMIN)).body.data.accessToken;

/** The raw Set-Cookie header for `name`. */
const setCookie = (res: request.Response, name: string): string => {
  const headers = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  const header = headers.find((h) => h.startsWith(`${name}=`));
  if (!header) throw new Error(`No ${name} cookie set`);
  return header;
};

/** "refreshToken=<value>", ready to send back in a Cookie header. */
const cookieOf = (res: request.Response): string => setCookie(res, "refreshToken").split(";")[0];

describe("auth", () => {
  beforeEach(async () => {
    store.users.clear();
    store.sessions.clear();
    store.nextId = 1;
    store.nextSessionId = 1;
    // Many cases here fail auth on purpose; keep them clear of the brute-force limiter.
    runtimeSettings.set({
      ...structuredClone(config.runtimeDefaults),
      rateLimit: { max: 10_000, authMax: 10_000 },
    });
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

  describe("refresh token cookie", () => {
    it("is set httpOnly, SameSite=Strict and scoped to /api/auth, never in the body", async () => {
      const res = await login(ADMIN);
      const header = setCookie(res, "refreshToken");
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/SameSite=Strict/i);
      expect(header).toMatch(/Path=\/api\/auth/);
      expect(header).toMatch(/Expires=/);
      expect(header).not.toMatch(/Secure/i);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it("refreshes from the cookie alone and rotates it", async () => {
      const first = cookieOf(await login(ADMIN));

      const rotated = await request(app).post("/api/auth/refresh").set("Cookie", first);
      expect(rotated.status).toBe(200);
      expect(rotated.body.data.accessToken).toEqual(expect.any(String));
      expect(rotated.body.data.user.email).toBe(ADMIN.email);
      expect(rotated.body.data.refreshToken).toBeUndefined();
      expect(cookieOf(rotated)).not.toBe(first);
    });

    it("rejects a replayed (superseded) cookie and revokes the session", async () => {
      const first = cookieOf(await login(ADMIN));
      const second = cookieOf(await request(app).post("/api/auth/refresh").set("Cookie", first));

      const replay = await request(app).post("/api/auth/refresh").set("Cookie", first);
      expect(replay.status).toBe(401);

      const afterReplay = await request(app).post("/api/auth/refresh").set("Cookie", second);
      expect(afterReplay.status).toBe(401);
    });

    it("returns 401 without a cookie or body, and clears a bad cookie", async () => {
      const none = await request(app).post("/api/auth/refresh");
      expect(none.status).toBe(401);

      const garbage = await request(app).post("/api/auth/refresh").set("Cookie", "refreshToken=nope");
      expect(garbage.status).toBe(401);
      expect(setCookie(garbage, "refreshToken")).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it("still accepts the token in the body for non-browser clients", async () => {
      const token = cookieOf(await login(ADMIN)).split("=")[1];
      const res = await request(app).post("/api/auth/refresh").send({ refreshToken: token });
      expect(res.status).toBe(200);
    });

    it("cannot be used after logout, which clears the cookie", async () => {
      const res = await login(ADMIN);
      const cookie = cookieOf(res);

      // Browsers send the cookie to /api/auth/logout too (cookie path /api/auth).
      const out = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${res.body.data.accessToken}`)
        .set("Cookie", cookie);
      expect(out.status).toBe(200);
      expect(setCookie(out, "refreshToken")).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(store.sessions.size).toBe(0);

      expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
    });
  });

  describe("sessions on multiple devices", () => {
    const signIn = async (userAgent: string) => {
      const res = await request(app).post("/api/auth/login").set("User-Agent", userAgent).send(ADMIN);
      return { cookie: cookieOf(res), accessToken: res.body.data.accessToken as string };
    };
    const refreshWith = (cookie: string) => request(app).post("/api/auth/refresh").set("Cookie", cookie);

    it("keeps one session per sign-in, recording the client", async () => {
      await signIn("laptop");
      await signIn("phone");
      const agents = [...store.sessions.values()].map((s) => s.userAgent).sort();
      expect(agents).toEqual(["laptop", "phone"]);
    });

    it("signing in on a second device doesn't sign out the first", async () => {
      const laptop = await signIn("laptop");
      const phone = await signIn("phone");

      const laptopRefresh = await refreshWith(laptop.cookie);
      const phoneRefresh = await refreshWith(phone.cookie);
      expect(laptopRefresh.status).toBe(200);
      expect(phoneRefresh.status).toBe(200);

      // Each device keeps rotating independently.
      expect((await refreshWith(cookieOf(laptopRefresh))).status).toBe(200);
      expect((await refreshWith(cookieOf(phoneRefresh))).status).toBe(200);
    });

    it("a replayed token revokes only that device's session", async () => {
      const laptop = await signIn("laptop");
      const phone = await signIn("phone");
      await refreshWith(laptop.cookie); // rotates the laptop's token

      expect((await refreshWith(laptop.cookie)).status).toBe(401); // replay
      expect((await refreshWith(phone.cookie)).status).toBe(200);
      expect(store.sessions.size).toBe(1);
    });

    it("logging out ends only the current device's session", async () => {
      const laptop = await signIn("laptop");
      const phone = await signIn("phone");

      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${laptop.accessToken}`)
        .set("Cookie", laptop.cookie);

      expect((await refreshWith(laptop.cookie)).status).toBe(401);
      expect((await refreshWith(phone.cookie)).status).toBe(200);
    });

    it("can't end another user's session with a stolen cookie on logout", async () => {
      const adminSession = await signIn("laptop");
      const token = await adminToken();
      await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send(USER);
      const user = (await login(USER)).body.data.accessToken as string;

      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${user}`)
        .set("Cookie", adminSession.cookie);

      expect((await refreshWith(adminSession.cookie)).status).toBe(200);
    });

    it("rejects tokens from before per-device sessions (no session id)", async () => {
      const legacy = jwt.sign({ sub: "1", email: ADMIN.email }, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: "1h",
      });
      expect((await refreshWith(`refreshToken=${legacy}`)).status).toBe(401);
    });

    it("a changed super admin password revokes all of that user's sessions", async () => {
      const laptop = await signIn("laptop");
      await signIn("phone");

      const admin = [...store.users.values()].find((u) => u.role === "admin")!;
      admin.password = "hash-of-an-old-password";
      await AuthService.ensureSuperAdmin();

      expect(store.sessions.size).toBe(0);
      expect((await refreshWith(laptop.cookie)).status).toBe(401);
    });
  });
});
