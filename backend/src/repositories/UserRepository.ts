import { UserModel } from "../models/User";

export const UserRepository = {
  create: async (data: { email: string; password: string }) => UserModel.create(data),
  findByEmail: async (email: string) => UserModel.findOne({ email }).select("+password").exec(),
  findById: async (id: string) => UserModel.findById(id).exec(),
  updateRefreshToken: async (id: string, refreshToken: string) =>
    UserModel.findByIdAndUpdate(id, { refreshToken }, { new: true }),
};
