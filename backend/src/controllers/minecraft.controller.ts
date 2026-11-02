import { asyncHandler } from "../middlewares/asyncHandler";
import { sendSuccess } from "../utils/response";
import { AuditService } from "../services/AuditService";
import { MinecraftService } from "../services/MinecraftService";

export const getStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, await MinecraftService.status());
});

export const startServer = asyncHandler(async (req, res) => {
  const data = await MinecraftService.start();
  await AuditService.record(req.user, "minecraft.start", undefined, data.container);
  sendSuccess(res, data);
});

export const stopServer = asyncHandler(async (req, res) => {
  const data = await MinecraftService.stop();
  await AuditService.record(req.user, "minecraft.stop", undefined, data.container);
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
  await AuditService.record(req.user, "minecraft.command", { command });
  sendSuccess(res, { command, response });
});

export const updateProperties = asyncHandler(async (req, res) => {
  const { properties } = req.body;
  const result = await MinecraftService.updateProperties(properties);
  await AuditService.record(req.user, "minecraft.properties.update", {
    keys: Object.keys(properties),
  });
  sendSuccess(res, result);
});

export const getProperties = asyncHandler(async (_req, res) => {
  const result = await MinecraftService.getProperties();
  sendSuccess(res, result);
});
