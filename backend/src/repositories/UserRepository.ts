import { UserModel, type UserRole } from "../models/User";

export const UserRepository = {
  create: async (data: { email: string; password: string; role?: UserRole }) =>
    UserModel.create(data),
  findByEmail: async (email: string) => UserModel.findOne({ email }).select("+password").exec(),
  findById: async (id: string) => UserModel.findById(id).exec(),
  findByIdWithRefreshToken: async (id: string) =>
    UserModel.findById(id).select("+refreshToken").exec(),
  updateRefreshToken: async (id: string, refreshToken: string) =>
    UserModel.findByIdAndUpdate(id, { refreshToken }, { new: true }).exec(),
  clearRefreshToken: async (id: string) =>
    UserModel.findByIdAndUpdate(id, { $unset: { refreshToken: 1 } }).exec(),
  setCredentials: async (id: string, data: { password: string; role: UserRole }) =>
    UserModel.findByIdAndUpdate(id, data, { new: true }).exec(),
};
