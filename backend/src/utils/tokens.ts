import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const signAccessToken = (payload: { sub: string; email: string }): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const signRefreshToken = (payload: { sub: string; email: string }): string =>
  jwt.sign(payload, env.REFRESH_TOKEN_SECRET, { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN });

export const verifyAccessToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.JWT_SECRET);

export const verifyRefreshToken = (token: string): string | jwt.JwtPayload =>
  jwt.verify(token, env.REFRESH_TOKEN_SECRET);
