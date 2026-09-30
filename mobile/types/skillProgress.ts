import type { SkillFocusId } from "../constants/skills";

/** Accumulated practice time of one skill, including what a given session contributed. */
export type SkillProgressDto = {
  skill_id: SkillFocusId;
  gained_seconds: number;
  total_seconds: number;
  level: number;
  previous_level: number;
  level_start_seconds: number;
  next_level_seconds: number | null;
};
