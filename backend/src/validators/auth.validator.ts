import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Browsers send the refresh token as a cookie; the body field is for non-browser clients.
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string(),
});
