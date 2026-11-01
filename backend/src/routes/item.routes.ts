import { Router } from "express";
import { createItem, deleteItem, getItem, listItems, updateItem } from "../controllers/item.controller";
import { validate } from "../middlewares/validate";
import { createItemSchema, itemIdParamSchema, updateItemSchema } from "../validators/item.validator";

const router = Router();

router.post("/", validate(createItemSchema), createItem);
router.get("/", listItems);
router.get("/:id", validate(itemIdParamSchema, "params"), getItem);
router.put("/:id", validate(itemIdParamSchema, "params"), validate(updateItemSchema), updateItem);
router.delete("/:id", validate(itemIdParamSchema, "params"), deleteItem);

export default router;
