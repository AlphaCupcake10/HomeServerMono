import "dotenv/config";
import { startServer, gracefulShutdown } from "./server";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { AuthService } from "./services/AuthService";
import { logger } from "./utils/logger";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const run = async (): Promise<void> => {
  await connectDatabase();
  await AuthService.ensureSuperAdmin();

  const server = startServer();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Don't hang forever on stuck connections.
    setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
    await gracefulShutdown(signal, server, async () => {
      await disconnectDatabase();
    });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

run().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
