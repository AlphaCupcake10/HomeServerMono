import { asyncHandler } from "../middlewares/asyncHandler";
import { ApiError } from "../utils/errors";
import { sendSuccess } from "../utils/response";
import { AuthService } from "../services/AuthService";

export const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);
  sendSuccess(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const tokens = await AuthService.login(req.body);
  sendSuccess(res, tokens);
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await AuthService.refresh(refreshToken);
  sendSuccess(res, tokens);
});

export const logout = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  await AuthService.logout(req.user.id);
  sendSuccess(res, { message: "Logged out" });
});
