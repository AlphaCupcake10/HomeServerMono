import { Router } from "express";
import authRouter from "./auth.routes";
import itemRouter from "./item.routes";
import minecraftRouter from "./minecraft.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/items", itemRouter);
router.use("/minecraft", minecraftRouter);

export default router;
