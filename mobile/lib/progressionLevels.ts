import type { TFunction } from "i18next";

/** Matches backend `XP_LEVEL_CATALOG_MAX`. */
export const PROGRESSION_NAMED_LEVEL_MAX = 20;

export function progressionLevelName(t: TFunction, level: number): string {
  const safe = Math.max(1, Math.floor(level));
  const key = `progression.levelNames.${safe}`;
  const name = t(key, { defaultValue: "" });
  if (name && name !== key) return name;
  return t("progression.levelNameFallback", { level: safe });
}
