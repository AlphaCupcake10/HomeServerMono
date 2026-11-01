import { Router } from "express";
import { login, logout, refresh, register } from "../controllers/auth.controller";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { loginSchema, refreshTokenSchema, registerSchema } from "../validators/auth.validator";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refresh);
router.post("/logout", protect, logout);

export default router;
