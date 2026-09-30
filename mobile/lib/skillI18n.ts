import type { TFunction } from "i18next";

import type { SkillBranch, SkillFocusId } from "../constants/skills";

export type SkillFocusTextField = "label" | "short" | "description" | "practice" | "covers";

function snakeToCamel(slug: string): string {
  return slug.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function skillBranchKey(branch: SkillBranch): string {
  return `skills.${snakeToCamel(branch)}`;
}

export function skillFocusKey(id: SkillFocusId, field: SkillFocusTextField): string {
  const [branch, focus] = id.split(".");
  return `skills.${snakeToCamel(branch)}.focuses.${snakeToCamel(focus)}.${field}`;
}

export function skillBranchDescription(branch: SkillBranch, tr: TFunction): string {
  return tr(`${skillBranchKey(branch)}.description`);
}

export function skillFocusText(
  id: SkillFocusId,
  field: SkillFocusTextField,
  tr: TFunction,
): string {
  return tr(skillFocusKey(id, field));
}
