import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import hpp from "hpp";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFound";
import { apiLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { sendSuccess } from "./utils/response";
import apiRouter from "./routes";
import { swaggerUiMiddleware, swaggerUiSetup } from "./docs/swagger";

const app = express();

// Behind a reverse proxy, set TRUST_PROXY to the number of hops so rate limiting sees real IPs.
app.set("trust proxy", env.TRUST_PROXY);
app.use(
  helmet({
    // The default `upgrade-insecure-requests` breaks Swagger UI assets over plain-HTTP LAN access.
    contentSecurityPolicy: { directives: { "upgrade-insecure-requests": null } },
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  }),
);
app.use(compression());
app.use(hpp());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(requestLogger);
app.use("/api", apiLimiter);
app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});

app.use("/api/docs", swaggerUiMiddleware, swaggerUiSetup);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
