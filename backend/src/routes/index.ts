import { Router } from "express";
import authRouter from "./auth.routes";
import minecraftRouter from "./minecraft.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/minecraft", minecraftRouter);

export default router;
