import { Router } from "express";
import { getConfig } from "../controllers/config.controller";
import { protect } from "../middlewares/auth";

const router = Router();

/**
 * @openapi
 * /api/config:
 *   get:
 *     tags: [Config]
 *     summary: Client-safe runtime config (which features are enabled)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ features: { minecraft: { enabled } } }"
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, getConfig);

export default router;
