import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import { config } from "./config/config";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFound";
import { apiLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { sendSuccess } from "./utils/response";
import apiRouter from "./routes";
import { swaggerUiMiddleware, swaggerUiSetup } from "./docs/swagger";

const app = express();

// Behind a reverse proxy, set server.trustProxy to the number of hops so rate limiting sees real IPs.
app.set("trust proxy", config.server.trustProxy);
app.use(
  helmet({
    // The default `upgrade-insecure-requests` breaks Swagger UI assets over plain-HTTP LAN access.
    contentSecurityPolicy: { directives: { "upgrade-insecure-requests": null } },
  }),
);
app.use(
  cors({
    origin: config.server.corsOrigins,
  }),
);
app.use(compression());
app.use(hpp());
app.use(cookieParser());
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
