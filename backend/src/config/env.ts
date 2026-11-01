import Joi from "joi";

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3000),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(8).required(),
  JWT_EXPIRES_IN: Joi.string().default("15m"),
  REFRESH_TOKEN_SECRET: Joi.string().min(8).required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default("7d"),
  CORS_ORIGINS: Joi.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),
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

export const env = value;
