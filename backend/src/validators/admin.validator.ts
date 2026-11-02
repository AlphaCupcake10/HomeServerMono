import Joi from "joi";

export const auditQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
});

export const containerParamsSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/)
    .required(),
});

export const containerLogsQuerySchema = Joi.object({
  tail: Joi.number().integer().min(1).max(5000).default(500),
  timestamps: Joi.boolean().default(false),
});
