import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Secrets + runtime mode come from env.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.SUPER_ADMIN_PASSWORD = "test-admin-password";
process.env.MINECRAFT_RCON_PASSWORD = "test";

// Non-secret settings: config/config.yaml plus a test overlay (JSON is valid YAML and avoids
// escaping Windows paths). config.local.yaml is never applied under NODE_ENV=test.
const overlayFile = path.join(os.tmpdir(), "home-server-mono-config.test.yaml");
fs.writeFileSync(
  overlayFile,
  JSON.stringify({
    database: { uri: "mongodb://localhost:27017/home_server_mono_test" },
    auth: { superAdminEmail: "admin@example.com" },
    minecraft: { dataDir: path.join(os.tmpdir(), "minecraft-test") },
  }),
);
process.env.CONFIG_OVERLAY = overlayFile;
