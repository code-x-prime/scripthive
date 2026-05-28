import { apiJson } from "./api";

export type AppSettingsMap = Record<string, string>;

export const settingsService = {
  get: () => apiJson<AppSettingsMap>("/settings"),
  update: (body: AppSettingsMap) =>
    apiJson<AppSettingsMap>("/settings", { method: "PUT", body: JSON.stringify(body) })
};
