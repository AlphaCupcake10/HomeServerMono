import Joi from "joi";

export const createItemSchema = Joi.object({
  name: Joi.string().required().min(1).max(120),
  description: Joi.string().max(1000).allow("", null),
});

export const updateItemSchema = Joi.object({
  name: Joi.string().min(1).max(120),
  description: Joi.string().max(1000).allow("", null),
}).min(1);

export const itemIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});
