import { Router } from "express";
import {
  getLogs,
  getProperties,
  getStatus,
  sendCommand,
  startServer,
  stopServer,
  updateProperties,
} from "../controllers/minecraft.controller";
import { validate } from "../middlewares/validate";
import { listLogsQuerySchema, sendCommandSchema, updatePropertiesSchema } from "../validators/minecraft.validator";

// Mounted behind protect + requireFeature("minecraft") in routes/index.ts: every route needs a
// signed-in user and returns 403 FEATURE_DISABLED while the feature is switched off.
const router = Router();

/**
 * @openapi
 * /api/minecraft/status:
 *   get:
 *     tags: [Minecraft]
 *     summary: Container state of the Minecraft server
 *     description: state is Docker's status (running, exited, ...) or "missing" when the container hasn't been created.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ container, state, running, startedAt, finishedAt, exitCode, health }"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Feature disabled (FEATURE_DISABLED)
 */
router.get("/status", getStatus);

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
router.post("/start", startServer);

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
router.post("/stop", stopServer);

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
router.get("/logs", validate(listLogsQuerySchema, "query"), getLogs);

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
router.post("/commands", validate(sendCommandSchema), sendCommand);

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
 *         description: Properties updated; restart the server to apply them
 *       401:
 *         description: Unauthorized
 */
router.put("/properties", validate(updatePropertiesSchema), updateProperties);

/**
 * @openapi
 * /api/minecraft/properties:
 *   get:
 *     tags: [Minecraft]
 *     summary: Read Minecraft server.properties
 *     security:
 *       - bearerAuth: []
 *     parameters: []
 *     responses:
 *       200:
 *         description: properties returned
 *       401:
 *         description: Unauthorized
 */
router.get("/properties", getProperties);

export default router;
