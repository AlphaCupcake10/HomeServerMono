import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { config } from "../config/config";
import { env } from "../config/env";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { UserRepository } from "../repositories/UserRepository";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens";

const SALT_ROUNDS = 10;

// Compared against when the email is unknown so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equalisation", SALT_ROUNDS);

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const issueTokens = async (user: { _id: unknown; email: string }) => {
  const id = String(user._id);
  const accessToken = signAccessToken({ sub: id, email: user.email });
  const refreshToken = signRefreshToken({ sub: id, email: user.email });
  await UserRepository.updateRefreshToken(id, hashToken(refreshToken));
  return { accessToken, refreshToken };
};

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
  async login(data: { email: string; password: string }) {
    const user = await UserRepository.findByEmail(data.email);
    const valid = await bcrypt.compare(data.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new ApiError(401, "Invalid credentials");
    }
    const tokens = await issueTokens(user);
    return { user: { id: String(user._id), email: user.email, role: user.role }, ...tokens };
  },
  async refresh(token: string) {
    let sub: string | undefined;
    try {
      const payload = verifyRefreshToken(token);
      sub = typeof payload === "string" ? undefined : payload.sub;
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }
    const user = sub ? await UserRepository.findByIdWithRefreshToken(sub) : null;
    if (!user || !user.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (!safeEqual(user.refreshToken, hashToken(token))) {
      // A validly signed but superseded token was replayed: revoke the session.
      await UserRepository.clearRefreshToken(String(user._id));
      throw new ApiError(401, "Invalid refresh token");
    }
    const tokens = await issueTokens(user);
    return { user: { id: String(user._id), email: user.email, role: user.role }, ...tokens };
  },
  async logout(userId: string) {
    await UserRepository.clearRefreshToken(userId);
  },
};
