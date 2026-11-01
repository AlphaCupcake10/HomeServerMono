import type { Server } from "node:http";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import app from "./app";

const port = Number(env.PORT ?? 3000);

export const startServer = (): Server => {
  const server = app.listen(port, () => logger.info({ port }, "Server started"));
  return server;
};

export const gracefulShutdown = async (
  signal: string,
  server: Server,
  closeConnections: () => Promise<void> = async () => {},
): Promise<void> => {
  logger.info({ signal }, "Shutdown signal received, closing server");
  await new Promise<void>((resolve) => {
    server.close(() => {
      closeConnections().then(() => resolve());
    });
  });
  logger.info("Server closed");
};

export default startServer;
