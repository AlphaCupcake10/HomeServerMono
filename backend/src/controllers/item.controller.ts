import { asyncHandler } from "../middlewares/asyncHandler";
import { sendSuccess } from "../utils/response";
import { ItemService } from "../services/ItemService";

export const createItem = asyncHandler(async (req, res) => {
  const item = await ItemService.create(req.body);
  sendSuccess(res, item, 201);
});

export const listItems = asyncHandler(async (_req, res) => {
  const items = await ItemService.list();
  sendSuccess(res, items);
});

export const getItem = asyncHandler(async (req, res) => {
  const item = await ItemService.getById(req.params.id as string);
  sendSuccess(res, item);
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await ItemService.update(req.params.id as string, req.body);
  sendSuccess(res, item);
});

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await ItemService.remove(req.params.id as string);
  sendSuccess(res, item);
});
