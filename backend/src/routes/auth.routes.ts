import { Router } from "express";
import { login, logout, refresh, register } from "../controllers/auth.controller";
import { protect, requireAdmin } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rateLimiter";
import { validate } from "../middlewares/validate";
import { loginSchema, refreshTokenSchema, registerSchema } from "../validators/auth.validator";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a user (super admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the super admin can create users
 *       422:
 *         description: Invalid request
 *       409:
 *         description: User already exists
 */
router.post("/register", protect, requireAdmin, validate(registerSchema), register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: User login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: "{ user, accessToken }. The refresh token is set as an httpOnly `refreshToken` cookie (path /api/auth), never returned in the body."
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authLimiter, validate(loginSchema), login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and issue a new access token
 *     description: Uses the `refreshToken` cookie. Non-browser clients may send the token in the body instead.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: "{ user, accessToken }; the rotated refresh token replaces the cookie"
 *       401:
 *         description: Missing, invalid or expired token (the cookie is cleared)
 */
router.post("/refresh", authLimiter, validate(refreshTokenSchema), refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session revoked and refresh cookie cleared
 *       401:
 *         description: Unauthorized
 */
router.post("/logout", protect, logout);

export default router;
