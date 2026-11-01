import { asyncHandler } from "./asyncHandler";
import { ApiError } from "../utils/errors";
import { UserRepository } from "../repositories/UserRepository";
import { verifyAccessToken } from "../utils/tokens";

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const payload = await verifyAccessToken(token);
    const sub = payload.sub as string;
    const user = await UserRepository.findById(sub);
    if (!user) {
      next(new ApiError(401, "Unauthorized"));
      return;
    }
    req.user = { id: String(user._id), email: user.email };
    next();
  } catch {
    next(new ApiError(401, "Unauthorized"));
  }
});
