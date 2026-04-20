import type { TFunction } from "i18next";

import type { SessionType } from "../constants/sessionTypes";
import { SESSION_TYPE_IDS } from "../constants/sessionTypes";

const MOOD_KEYS = ["mood1", "mood2", "mood3", "mood4", "mood5"] as const;

/** Legacy display strings stored before slug-based session types. */
const LEGACY_TO_ID: Record<string, SessionType> = {
  "Beat Making": "beat_making",
  Mixing: "mixing",
  "Sound Design": "sound_design",
};

function normalizeSessionTypeId(type: string): SessionType | string {
  const trimmed = type.trim();
  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  if (trimmed in LEGACY_TO_ID) {
    return LEGACY_TO_ID[trimmed];
  }
  if ((SESSION_TYPE_IDS as readonly string[]).includes(normalized)) {
    return normalized as SessionType;
  }
  // Handle backend/UI variants that still appear in legacy rows.
  if (normalized === "mix_master" || normalized === "mix_and_mastering") {
    return "mix_and_master";
  }
  return normalized;
}

export function sessionTypeLabel(type: string, tr: TFunction): string {
  const id = normalizeSessionTypeId(type);
  switch (id) {
    case "beat_making":
      return tr("sessionTypes.beatMaking");
    case "mixing":
      return tr("sessionTypes.mixing");
    case "mastering":
      return tr("sessionTypes.mastering");
    case "mix_and_master":
      return tr("sessionTypes.mixAndMaster");
    case "sound_design":
      return tr("sessionTypes.soundDesign");
    case "recording":
      return tr("sessionTypes.recording");
    case "songwriting":
      return tr("sessionTypes.songwriting");
    case "arrangement":
      return tr("sessionTypes.arrangement");
    case "vocal_production":
      return tr("sessionTypes.vocalProduction");
    case "learning":
      return tr("sessionTypes.learning");
    default:
      return type;
  }
}

export function sessionMoodLabel(level: number | null | undefined, tr: TFunction): string {
  if (level == null || level < 1 || level > 5) return "—";
  return tr(`sessionDetail.${MOOD_KEYS[level - 1]}`);
}
