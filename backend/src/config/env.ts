import Joi from "joi";

/** Secrets and the runtime mode. Everything else is in `config` (backend/config/*.yaml). */
export interface Env {
  NODE_ENV: "development" | "production" | "test";
  JWT_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  SUPER_ADMIN_PASSWORD: string;
  MINECRAFT_RCON_PASSWORD: string;
}

const envSchema = Joi.object<Env>({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  JWT_SECRET: Joi.string().min(8).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(8).required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
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
    const problems = [
      weak.length > 0 && `placeholder ("change-me") values in [${weak.join(", ")}]`,
      short.length > 0 && `secrets shorter than 32 chars in [${short.join(", ")}]`,
    ].filter(Boolean);
    throw new Error(
      `Insecure production configuration: ${problems.join("; ")}. ` +
        `Generate a secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
}
