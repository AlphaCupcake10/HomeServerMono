import { Router } from "express";
import { getSettings, listAudit, updateSettings } from "../controllers/admin.controller";
import { protect, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { auditQuerySchema } from "../validators/admin.validator";

// Super admin only: role "admin" is held solely by the account synced from auth.superAdminEmail.
const router = Router();
router.use(protect, requireAdmin);

/**
 * @openapi
 * /api/admin/settings:
 *   get:
 *     tags: [Admin]
 *     summary: Runtime settings, their defaults, last change and the read-only YAML config
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ values, defaults, updatedAt, updatedBy, deployment }"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super admin only
 *   put:
 *     tags: [Admin]
 *     summary: Update runtime settings (partial; applied immediately, recorded in the audit log)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               features:
 *                 type: object
 *                 properties:
 *                   minecraft:
 *                     type: object
 *                     properties:
 *                       enabled:
 *                         type: boolean
 *               exposeErrorDetails:
 *                 type: boolean
 *               logLevel:
 *                 type: string
 *                 enum: [fatal, error, warn, info, debug, trace, silent]
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   max:
 *                     type: integer
 *                   authMax:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Updated settings (same shape as GET)
 *       403:
 *         description: Super admin only
 *       422:
 *         description: Invalid or unknown setting
 */
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

/**
 * @openapi
 * /api/admin/audit:
 *   get:
 *     tags: [Admin]
 *     summary: Latest audit log entries (newest first)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *     responses:
 *       200:
 *         description: "{ entries: [{ id, actor, action, target, details, createdAt }] }"
 *       403:
 *         description: Super admin only
 */
router.get("/audit", validate(auditQuerySchema, "query"), listAudit);

export default router;
