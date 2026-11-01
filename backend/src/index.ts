import "dotenv/config";
import { startServer, gracefulShutdown } from "./server";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./utils/logger";

const run = async (): Promise<void> => {
  await connectDatabase();

  const server = startServer();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutdown signal received");
    await gracefulShutdown(signal, server, async () => {
      await disconnectDatabase();
    });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

void run();
