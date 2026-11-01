import { ItemModel } from "../models/Item";

type ItemData = { name: string; description?: string };

export const ItemRepository = {
  create: async (data: ItemData) => ItemModel.create(data),
  findAll: async () => ItemModel.find().sort({ createdAt: -1 }).limit(100),
  findById: async (id: string) => ItemModel.findById(id),
  updateById: async (id: string, data: Partial<ItemData>) =>
    ItemModel.findByIdAndUpdate(id, data, { new: true }),
  deleteById: async (id: string) => ItemModel.findByIdAndDelete(id),
};
