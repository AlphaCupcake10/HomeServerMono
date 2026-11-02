import Joi from "joi";

export const auditQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
});
