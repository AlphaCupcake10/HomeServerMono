import { UserModel, type UserRole } from "../models/User";

export const UserRepository = {
  create: async (data: { email: string; password: string; role?: UserRole }) =>
    UserModel.create(data),
  findByEmail: async (email: string) => UserModel.findOne({ email }).select("+password").exec(),
  findById: async (id: string) => UserModel.findById(id).exec(),
  setCredentials: async (id: string, data: { password: string; role: UserRole }) =>
    UserModel.findByIdAndUpdate(id, data, { new: true }).exec(),
};
