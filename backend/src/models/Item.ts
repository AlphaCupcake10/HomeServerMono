import { Schema, model, type HydratedDocument } from "mongoose";

export interface Item {
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const itemSchema = new Schema<Item>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export type ItemDocument = HydratedDocument<Item>;

export const ItemModel = model<Item>("Item", itemSchema);
