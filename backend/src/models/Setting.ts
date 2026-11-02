import { Schema, model } from "mongoose";

export interface Actor {
  id: string;
  email: string;
}

/** A named settings document; currently only `_id: "runtime"` (see SettingsService). */
export interface Setting {
  _id: string;
  values: Record<string, unknown>;
  updatedBy?: Actor | null;
  updatedAt?: Date;
}

const actorSchema = new Schema<Actor>({ id: String, email: String }, { _id: false });

const settingSchema = new Schema<Setting>(
  {
    _id: { type: String, required: true },
    values: { type: Schema.Types.Mixed, required: true, default: {} },
    updatedBy: { type: actorSchema, default: null },
  },
  // `minimize: false` keeps empty objects so stored values round-trip unchanged.
  { timestamps: { createdAt: false, updatedAt: true }, minimize: false },
);

export const SettingModel = model<Setting>("Setting", settingSchema);
