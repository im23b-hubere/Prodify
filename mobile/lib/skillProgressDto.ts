import { isSkillFocusId } from "../constants/skills";
import type { SkillProgressDto } from "../types/skillProgress";

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function tryParseSkillProgress(raw: unknown): SkillProgressDto | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (!isSkillFocusId(v.skill_id)) return null;
  const counts = [
    v.gained_seconds,
    v.total_seconds,
    v.level,
    v.previous_level,
    v.level_start_seconds,
  ];
  if (!counts.every(isCount)) return null;
  const nextLevelSeconds = isCount(v.next_level_seconds) ? v.next_level_seconds : null;
  return {
    skill_id: v.skill_id,
    gained_seconds: v.gained_seconds as number,
    total_seconds: v.total_seconds as number,
    level: v.level as number,
    previous_level: v.previous_level as number,
    level_start_seconds: v.level_start_seconds as number,
    next_level_seconds: nextLevelSeconds,
  };
}

/** Drops rows this app version cannot render instead of failing the whole list. */
export function parseSkillProgressList(raw: unknown): SkillProgressDto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(tryParseSkillProgress).filter((item) => item !== null);
}
