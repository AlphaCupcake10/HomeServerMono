import { asyncHandler } from "../middlewares/asyncHandler";
import { sendSuccess } from "../utils/response";
import { AuthService } from "../services/AuthService";

export const register = asyncHandler(async (req, res) => {
  const tokens = await AuthService.register(req.body);
  sendSuccess(res, tokens, 201);
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
  await AuthService.logout(req.user?.id ?? "");
  sendSuccess(res, { message: "Logged out" });
});
