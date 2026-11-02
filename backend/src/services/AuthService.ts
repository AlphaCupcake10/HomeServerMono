import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { config } from "../config/config";
import { env } from "../config/env";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { SessionRepository } from "../repositories/SessionRepository";
import { UserRepository } from "../repositories/UserRepository";
import {
  hashToken,
  refreshTokenSessionId,
  signAccessToken,
  signRefreshToken,
  tokenExpiresAt,
  verifyRefreshToken,
} from "../utils/tokens";

const SALT_ROUNDS = 10;

/** Describes the client a session belongs to (shown in a future "active sessions" view). */
export interface ClientInfo {
  userAgent?: string;
}

type SessionUser = { _id: unknown; email: string; role: string };

// Compared against when the email is unknown so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equalisation", SALT_ROUNDS);

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const sessionResult = (user: SessionUser, refreshToken: string) => {
  const id = String(user._id);
  return {
    user: { id, email: user.email, role: user.role },
    accessToken: signAccessToken({ sub: id, email: user.email }),
    refreshToken,
  };
};

const expiryOf = (token: string): Date => {
  const expiresAt = tokenExpiresAt(token);
  if (!expiresAt) throw new Error("Refresh token has no expiry");
  return expiresAt;
};

/** Starts a new session (one per signed-in device) and issues its first token pair. */
const startSession = async (user: SessionUser, client: ClientInfo) => {
  const userId = String(user._id);
  const sid = SessionRepository.newId();
  const refreshToken = signRefreshToken({ sub: userId, email: user.email, sid });
  await SessionRepository.create({
    id: sid,
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: expiryOf(refreshToken),
    userAgent: client.userAgent?.slice(0, 200),
  });
  return sessionResult(user, refreshToken);
};

const invalidRefreshToken = () => new ApiError(401, "Invalid refresh token");

export const AuthService = {
  /**
   * Creates or syncs the super admin from auth.superAdminEmail (config) and SUPER_ADMIN_PASSWORD
   * (env). Called on startup; changing either and restarting updates the account.
   */
  async ensureSuperAdmin(): Promise<void> {
    const email = config.auth.superAdminEmail.trim().toLowerCase();
    const existing = await UserRepository.findByEmail(email);
    if (!existing) {
      const password = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
      await UserRepository.create({ email, password, role: "admin" });
      logger.info({ email }, "Super admin created");
      return;
    }
    const passwordMatches = await bcrypt.compare(env.SUPER_ADMIN_PASSWORD, existing.password);
    if (!passwordMatches || existing.role !== "admin") {
      const password = passwordMatches
        ? existing.password
        : await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
      await UserRepository.setCredentials(String(existing._id), { password, role: "admin" });
      if (!passwordMatches) {
        // A new password must not leave old sign-ins alive.
        await SessionRepository.deleteAllForUser(String(existing._id));
      }
      logger.info({ email }, "Super admin synced with environment");
    }
  },
  /** Admin-only: creates a regular user. Does not log the new user in. */
  async register(data: { email: string; password: string }) {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await UserRepository.create({
      email: data.email,
      password: hashedPassword,
      role: "user",
    });
    return { user: { id: String(user._id), email: user.email, role: user.role } };
  },
  /** Signs in and starts a new session; other devices' sessions are unaffected. */
  async login(data: { email: string; password: string }, client: ClientInfo = {}) {
    const user = await UserRepository.findByEmail(data.email);
    const valid = await bcrypt.compare(data.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new ApiError(401, "Invalid credentials");
    }
    return startSession(user, client);
  },
  /** Rotates the refresh token within its session. */
  async refresh(token: string) {
    let sub: string | undefined;
    let sid: string | undefined;
    try {
      const payload = verifyRefreshToken(token);
      if (typeof payload !== "string") {
        sub = payload.sub;
        sid = typeof payload.sid === "string" ? payload.sid : undefined;
      }
    } catch {
      throw invalidRefreshToken();
    }
    // Tokens without a session id predate per-device sessions: sign in again.
    if (!sub || !sid) throw invalidRefreshToken();

    const session = await SessionRepository.findById(sid);
    if (!session || session.userId !== sub) throw invalidRefreshToken();
    if (!safeEqual(session.tokenHash, hashToken(token))) {
      // A validly signed but superseded token was replayed (possibly stolen): end this session.
      // Other devices keep their own sessions.
      await SessionRepository.delete(sid, sub);
      logger.warn({ userId: sub, sessionId: sid }, "Refresh token reuse detected; session revoked");
      throw invalidRefreshToken();
    }

    const user = await UserRepository.findById(sub);
    if (!user) {
      await SessionRepository.delete(sid, sub);
      throw invalidRefreshToken();
    }
    const refreshToken = signRefreshToken({ sub, email: user.email, sid });
    await SessionRepository.rotate(sid, hashToken(refreshToken), expiryOf(refreshToken));
    return sessionResult(user, refreshToken);
  },
  /** Ends the session the refresh token belongs to (this device only). */
  async logout(userId: string, refreshToken?: string) {
    const sid = refreshToken ? refreshTokenSessionId(refreshToken) : undefined;
    if (sid) {
      await SessionRepository.delete(sid, userId);
    }
  },
};
