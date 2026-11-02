import mongoose from "mongoose";
import { config } from "./config";

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(config.database.uri);
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.connection.close();
};

export default mongoose.connection;
