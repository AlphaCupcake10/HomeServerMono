import type { Response } from "express";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  message?: string;
}

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200): void => {
  res.status(statusCode).json({ success: true, data });
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void => {
  const body: ApiResponse<unknown> = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  res.status(statusCode).json(body);
};
