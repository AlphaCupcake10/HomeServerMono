import Joi from "joi";

export const listLogsQuerySchema = Joi.object({
  tail: Joi.number().integer().min(1).max(1000).default(50),
});

export const sendCommandSchema = Joi.object({
  command: Joi.string().required().min(1).max(256),
});

export const updatePropertiesSchema = Joi.object({
  properties: Joi.object().pattern(/^[a-zA-Z0-9_.-]+$/, Joi.string()).required(),
});
