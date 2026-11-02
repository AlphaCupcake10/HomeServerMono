import Joi from "joi";
import type { SignOptions } from "jsonwebtoken";

export interface Env {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: NonNullable<SignOptions["expiresIn"]>;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRES_IN: NonNullable<SignOptions["expiresIn"]>;
  CORS_ORIGINS: string;
  TRUST_PROXY: number;
  EXPOSE_ERROR_DETAILS: boolean;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  AUTH_RATE_LIMIT_MAX: number;
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
  MINECRAFT_CONTAINER_NAME: string;
  MINECRAFT_DATA_DIR: string;
  MINECRAFT_RCON_PORT: number;
  MINECRAFT_RCON_HOST: string;
  MINECRAFT_RCON_PASSWORD: string;
}

const envSchema = Joi.object<Env>({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3000),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(8).required(),
  JWT_EXPIRES_IN: Joi.string().default("15m"),
  REFRESH_TOKEN_SECRET: Joi.string().min(8).required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default("7d"),
  CORS_ORIGINS: Joi.string().default("http://localhost:3000"),
  // Number of reverse-proxy hops to trust for client IPs (0 = none).
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  // Include the underlying error (name, message, code) in 5xx responses. Defaults to on outside
  // production; stack traces are only ever sent when NODE_ENV is not production.
  EXPOSE_ERROR_DETAILS: Joi.boolean(),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(10),
  SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
  MINECRAFT_CONTAINER_NAME: Joi.string().required(),
  MINECRAFT_DATA_DIR: Joi.string().required(),
  MINECRAFT_RCON_PORT: Joi.number().default(25575),
  MINECRAFT_RCON_HOST: Joi.string().default("127.0.0.1"),
  MINECRAFT_RCON_PASSWORD: Joi.string().required(),
});

const { error, value } = envSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

export const env = value as Env;
env.EXPOSE_ERROR_DETAILS ??= env.NODE_ENV !== "production";

// Refuse to boot in production with template/placeholder or short secrets.
if (env.NODE_ENV === "production") {
  const secrets: (keyof Env)[] = [
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
    "SUPER_ADMIN_PASSWORD",
    "MINECRAFT_RCON_PASSWORD",
  ];
  const weak = secrets.filter((key) => String(env[key]).toLowerCase().includes("change-me"));
  const short = (["JWT_SECRET", "REFRESH_TOKEN_SECRET"] as const).filter(
    (key) => env[key].length < 32,
  );
  if (weak.length > 0 || short.length > 0) {
    throw new Error(
      `Insecure production configuration: placeholder values in [${weak.join(", ")}], ` +
        `secrets shorter than 32 chars in [${short.join(", ")}]`,
    );
  }
}
