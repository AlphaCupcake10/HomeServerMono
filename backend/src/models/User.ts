import { Schema, model, type HydratedDocument } from "mongoose";

export interface User {
  _id?: unknown;
  email: string;
  password: string;
  refreshToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, minlength: 8 },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<User>;

export const UserModel = model<User>("User", userSchema);
