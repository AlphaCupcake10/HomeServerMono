import { asyncHandler } from "../middlewares/asyncHandler";
import { sendSuccess } from "../utils/response";
import { MinecraftService } from "../services/MinecraftService";

export const startServer = asyncHandler(async (_req, res) => {
  const data = await MinecraftService.start();
  sendSuccess(res, data);
});

export const stopServer = asyncHandler(async (_req, res) => {
  const data = await MinecraftService.stop();
  sendSuccess(res, data);
});

export const getLogs = asyncHandler(async (req, res) => {
  const tail = Number(req.query.tail);
  const logs = await MinecraftService.getLogs(tail);
  sendSuccess(res, { logs });
});

export const sendCommand = asyncHandler(async (req, res) => {
  const { command } = req.body;
  const response = await MinecraftService.sendCommand(command);
  sendSuccess(res, { command, response });
});

export const updateProperties = asyncHandler(async (req, res) => {
  const { properties } = req.body;
  const result = await MinecraftService.updateProperties(properties);
  sendSuccess(res, result);
});

export const getProperties = asyncHandler(async (_req, res) => {
  const result = await MinecraftService.getProperties();
  sendSuccess(res, result);
});
