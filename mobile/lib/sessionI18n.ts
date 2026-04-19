import type { TFunction } from "i18next";

const MOOD_KEYS = ["mood1", "mood2", "mood3", "mood4", "mood5"] as const;

export function sessionTypeLabel(type: string, tr: TFunction): string {
  switch (type) {
    case "Beat Making":
      return tr("sessionTypes.beatMaking");
    case "Mixing":
      return tr("sessionTypes.mixing");
    case "Sound Design":
      return tr("sessionTypes.soundDesign");
    default:
      return type;
  }
}

export function sessionMoodLabel(level: number | null | undefined, tr: TFunction): string {
  if (level == null || level < 1 || level > 5) return "—";
  return tr(`sessionDetail.${MOOD_KEYS[level - 1]}`);
}
