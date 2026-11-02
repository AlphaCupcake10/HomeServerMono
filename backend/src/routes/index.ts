import { Router } from "express";
import { protect } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import adminRouter from "./admin.routes";
import authRouter from "./auth.routes";
import configRouter from "./config.routes";
import minecraftRouter from "./minecraft.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/config", configRouter);
router.use("/admin", adminRouter);
// Authenticate first so anonymous callers get 401, not the feature state.
router.use("/minecraft", protect, requireFeature("minecraft"), minecraftRouter);

export default router;
