import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/config";
import { env } from "../config/env";

interface TokenPayload {
  sub: string;
  email: string;
}

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: config.auth.accessTokenTtl, algorithm: "HS256" });

// A unique jti guarantees every issued refresh token differs, even within the same second.
export const signRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: config.auth.refreshTokenTtl,
    algorithm: "HS256",
    jwtid: crypto.randomUUID(),
  });

export const verifyAccessToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

export const verifyRefreshToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.REFRESH_TOKEN_SECRET, { algorithms: ["HS256"] });

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
