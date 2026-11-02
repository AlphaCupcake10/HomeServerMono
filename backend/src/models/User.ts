import { Schema, model, type HydratedDocument } from "mongoose";

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  _id?: unknown;
  email: string;
  password: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "user", required: true },
    // Refresh tokens live in the `sessions` collection (one per signed-in device).
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<User>;

export const UserModel = model<User>("User", userSchema);
