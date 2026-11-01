import { ApiError } from "../utils/errors";
import { ItemRepository } from "../repositories/ItemRepository";

type ItemData = { name: string; description?: string };

export const ItemService = {
  async create(data: ItemData) {
    return ItemRepository.create(data);
  },
  async list() {
    return ItemRepository.findAll();
  },
  async getById(id: string) {
    const item = await ItemRepository.findById(id);
    if (!item) {
      throw new ApiError(404, "Item not found");
    }
    return item;
  },
  async update(id: string, data: Partial<ItemData>) {
    const item = await ItemRepository.updateById(id, data);
    if (!item) {
      throw new ApiError(404, "Item not found");
    }
    return item;
  },
  async remove(id: string) {
    const item = await ItemRepository.deleteById(id);
    if (!item) {
      throw new ApiError(404, "Item not found");
    }
    return item;
  },
};
