import { branchOfFocus, isSkillBranch, isSkillFocusId } from "../constants/skills";
import type {
  BranchSkillDto,
  FocusSkillDto,
  SkillNodeDto,
  SkillProfileDto,
} from "../types/skillProfile";

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function tryParseNode(v: Record<string, unknown>): SkillNodeDto | null {
  const counts = [v.total_seconds, v.level, v.level_start_seconds, v.session_count];
  if (!counts.every(isCount)) return null;
  return {
    total_seconds: v.total_seconds as number,
    level: v.level as number,
    level_start_seconds: v.level_start_seconds as number,
    next_level_seconds: isCount(v.next_level_seconds) ? v.next_level_seconds : null,
    session_count: v.session_count as number,
    last_trained_at: typeof v.last_trained_at === "string" ? v.last_trained_at : null,
  };
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function tryParseBranch(raw: unknown): BranchSkillDto | null {
  const v = asRecord(raw);
  if (!v || !isSkillBranch(v.branch)) return null;
  const node = tryParseNode(v);
  return node ? { ...node, branch: v.branch } : null;
}

function tryParseFocus(raw: unknown): FocusSkillDto | null {
  const v = asRecord(raw);
  if (!v || !isSkillFocusId(v.skill_id)) return null;
  const node = tryParseNode(v);
  return node ? { ...node, skill_id: v.skill_id, branch: branchOfFocus(v.skill_id) } : null;
}

/** Skips rows this app version does not know; fails only if the payload itself is unusable. */
export function tryParseSkillProfile(raw: unknown): SkillProfileDto | null {
  const v = asRecord(raw);
  if (!v || !isCount(v.total_seconds) || !Array.isArray(v.branches) || !Array.isArray(v.focuses)) {
    return null;
  }
  return {
    total_seconds: v.total_seconds,
    branches: v.branches.map(tryParseBranch).filter((item) => item !== null),
    focuses: v.focuses.map(tryParseFocus).filter((item) => item !== null),
  };
}
