import crypto from "node:crypto";
import type { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/config";
import { env } from "../config/env";

/** The refresh token travels only in this httpOnly cookie, never in response bodies. */
export const REFRESH_COOKIE = "refreshToken";

/** When a signed token expires (from its `exp` claim), or undefined if it has none. */
export const tokenExpiresAt = (token: string): Date | undefined => {
  const decoded = jwt.decode(token);
  const exp = decoded && typeof decoded !== "string" ? decoded.exp : undefined;
  return exp ? new Date(exp * 1000) : undefined;
};

/** Scoped to the auth routes so the cookie isn't sent with every API call. */
export const refreshCookieOptions = (token?: string): CookieOptions => {
  const expires = token ? tokenExpiresAt(token) : undefined;
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: config.auth.refreshCookieSecure,
    path: "/api/auth",
    ...(expires ? { expires } : {}),
  };
};

interface TokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload extends TokenPayload {
  /** Session id: one per signed-in device, kept across rotations. */
  sid: string;
}

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: config.auth.accessTokenTtl, algorithm: "HS256" });

// A unique jti guarantees every issued refresh token differs, even within the same second.
export const signRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: config.auth.refreshTokenTtl,
    algorithm: "HS256",
    jwtid: crypto.randomUUID(),
  });

export const verifyAccessToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

export const verifyRefreshToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.REFRESH_TOKEN_SECRET, { algorithms: ["HS256"] });

/**
 * The session id of a correctly signed refresh token, even an expired one (used to end the
 * session on logout). Undefined for forged or malformed tokens.
 */
export const refreshTokenSessionId = (token: string): string | undefined => {
  try {
    const payload = jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    });
    return typeof payload !== "string" && typeof payload.sid === "string" ? payload.sid : undefined;
  } catch {
    return undefined;
  }
};

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
