import { Router } from "express";
import { getLogs, sendCommand, startServer, stopServer, updateProperties } from "../controllers/minecraft.controller";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { listLogsQuerySchema, sendCommandSchema, updatePropertiesSchema } from "../validators/minecraft.validator";

const router = Router();

/**
 * @openapi
 * /api/minecraft/start:
 *   post:
 *     tags: [Minecraft]
 *     summary: Start the Minecraft server container
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server started
 *       401:
 *         description: Unauthorized
 */
router.post("/start", protect, startServer);

/**
 * @openapi
 * /api/minecraft/stop:
 *   post:
 *     tags: [Minecraft]
 *     summary: Stop the Minecraft server container
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server stopped
 *       401:
 *         description: Unauthorized
 */
router.post("/stop", protect, stopServer);

/**
 * @openapi
 * /api/minecraft/logs:
 *   get:
 *     tags: [Minecraft]
 *     summary: Get server logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tail
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of log lines to return
 *     responses:
 *       200:
 *         description: Logs returned
 *       401:
 *         description: Unauthorized
 */
router.get("/logs", protect, validate(listLogsQuerySchema, "query"), getLogs);

/**
 * @openapi
 * /api/minecraft/commands:
 *   post:
 *     tags: [Minecraft]
 *     summary: Send a Minecraft server command via RCON
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *     responses:
 *       200:
 *         description: Command executed
 *       401:
 *         description: Unauthorized
 */
router.post("/commands", protect, validate(sendCommandSchema), sendCommand);

/**
 * @openapi
 * /api/minecraft/properties:
 *   put:
 *     tags: [Minecraft]
 *     summary: Update Minecraft server.properties
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [properties]
 *             properties:
 *               properties:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *     responses:
 *       200:
 *         description: Properties updated and server restarted
 *       401:
 *         description: Unauthorized
 */
router.put("/properties", protect, validate(updatePropertiesSchema), updateProperties);

export default router;
