import type { SkillBranch, SkillFocusId } from "../constants/skills";

export type SkillNodeDto = {
  total_seconds: number;
  level: number;
  level_start_seconds: number;
  next_level_seconds: number | null;
  session_count: number;
  last_trained_at: string | null;
};

export type BranchSkillDto = SkillNodeDto & { branch: SkillBranch };

export type FocusSkillDto = SkillNodeDto & { skill_id: SkillFocusId; branch: SkillBranch };

export type SkillProfileDto = {
  total_seconds: number;
  branches: BranchSkillDto[];
  focuses: FocusSkillDto[];
};
