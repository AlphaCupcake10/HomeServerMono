import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ApiError } from "../utils/errors";
import { UserRepository } from "../repositories/UserRepository";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens";

const SALT_ROUNDS = 10;

export const AuthService = {
  async register(data: { email: string; password: string }) {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await UserRepository.create({ email: data.email, password: hashedPassword });
    const accessToken = signAccessToken({ sub: String(user._id), email: user.email });
    const refreshToken = signRefreshToken({ sub: String(user._id), email: user.email });
    const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await UserRepository.updateRefreshToken(String(user._id), hashedRefreshToken);
    return { user: { id: String(user._id), email: user.email }, accessToken, refreshToken };
  },
  async login(data: { email: string; password: string }) {
    const user = await UserRepository.findByEmail(data.email);
    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      throw new ApiError(401, "Invalid credentials");
    }
    const accessToken = signAccessToken({ sub: String(user._id), email: user.email });
    const refreshToken = signRefreshToken({ sub: String(user._id), email: user.email });
    const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await UserRepository.updateRefreshToken(String(user._id), hashedRefreshToken);
    return { user: { id: String(user._id), email: user.email }, accessToken, refreshToken };
  },
  async refresh(token: string) {
    const payload = await verifyRefreshToken(token);
    const sub = payload.sub as string;
    const user = await UserRepository.findById(sub);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    const newAccessToken = signAccessToken({ sub, email: user.email });
    const newRefreshToken = signRefreshToken({ sub, email: user.email });
    const hashedRefreshToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    await UserRepository.updateRefreshToken(sub, hashedRefreshToken);
    return { user: { id: sub, email: user.email }, accessToken: newAccessToken, refreshToken: newRefreshToken };
  },
  async logout(userId: string) {
    await UserRepository.updateRefreshToken(userId, "");
  },
};
