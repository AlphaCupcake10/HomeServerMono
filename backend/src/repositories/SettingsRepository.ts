import { SettingModel, type Actor } from "../models/Setting";

export const SettingsRepository = {
  get: async (id: string) => SettingModel.findById(id).lean().exec(),
  save: async (id: string, values: Record<string, unknown>, updatedBy: Actor | null) =>
    SettingModel.findByIdAndUpdate(
      id,
      { values, updatedBy },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec(),
};
