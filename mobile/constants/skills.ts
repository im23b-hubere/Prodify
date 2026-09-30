/**
 * Canonical skill catalog (API + storage). Level 1 branches reuse session type ids;
 * level 2 focuses are `branch.focus` slugs. Copy lives under `skills.*` in locales/en.json.
 * Must stay in sync with backend/app/skill_catalog.py.
 */
import type { SessionType } from "./sessionTypes";

export type SkillBranch = Exclude<SessionType, "mix_and_master" | "learning">;

export const SKILL_BRANCHES: readonly SkillBranch[] = [
  "beat_making",
  "mixing",
  "mastering",
  "sound_design",
  "recording",
  "songwriting",
  "arrangement",
  "vocal_production",
];

/** Array order is the curated display order within each branch. */
export const SKILL_FOCUSES = [
  { id: "beat_making.drums", branch: "beat_making" },
  { id: "beat_making.groove", branch: "beat_making" },
  { id: "beat_making.bass", branch: "beat_making" },
  { id: "beat_making.chords_melody", branch: "beat_making" },
  { id: "beat_making.sampling", branch: "beat_making" },
  { id: "beat_making.sound_selection", branch: "beat_making" },

  { id: "mixing.balance", branch: "mixing" },
  { id: "mixing.eq", branch: "mixing" },
  { id: "mixing.dynamics", branch: "mixing" },
  { id: "mixing.saturation", branch: "mixing" },
  { id: "mixing.space", branch: "mixing" },
  { id: "mixing.stereo", branch: "mixing" },
  { id: "mixing.automation", branch: "mixing" },
  { id: "mixing.translation", branch: "mixing" },

  { id: "mastering.tonal_balance", branch: "mastering" },
  { id: "mastering.dynamics", branch: "mastering" },
  { id: "mastering.loudness", branch: "mastering" },
  { id: "mastering.stereo", branch: "mastering" },
  { id: "mastering.references", branch: "mastering" },
  { id: "mastering.delivery", branch: "mastering" },

  { id: "sound_design.synthesis", branch: "sound_design" },
  { id: "sound_design.advanced_synthesis", branch: "sound_design" },
  { id: "sound_design.modulation", branch: "sound_design" },
  { id: "sound_design.sampling", branch: "sound_design" },
  { id: "sound_design.effects", branch: "sound_design" },
  { id: "sound_design.layering", branch: "sound_design" },

  { id: "recording.mic_technique", branch: "recording" },
  { id: "recording.vocals", branch: "recording" },
  { id: "recording.gain_staging", branch: "recording" },
  { id: "recording.room", branch: "recording" },
  { id: "recording.tracking", branch: "recording" },
  { id: "recording.instruments", branch: "recording" },

  { id: "songwriting.melody", branch: "songwriting" },
  { id: "songwriting.harmony", branch: "songwriting" },
  { id: "songwriting.lyrics", branch: "songwriting" },
  { id: "songwriting.song_form", branch: "songwriting" },
  { id: "songwriting.hooks", branch: "songwriting" },

  { id: "arrangement.structure", branch: "arrangement" },
  { id: "arrangement.transitions", branch: "arrangement" },
  { id: "arrangement.energy", branch: "arrangement" },
  { id: "arrangement.variation", branch: "arrangement" },
  { id: "arrangement.instrumentation", branch: "arrangement" },

  { id: "vocal_production.comping", branch: "vocal_production" },
  { id: "vocal_production.tuning", branch: "vocal_production" },
  { id: "vocal_production.chain", branch: "vocal_production" },
  { id: "vocal_production.fx", branch: "vocal_production" },
  { id: "vocal_production.layering", branch: "vocal_production" },
] as const satisfies readonly { id: `${SkillBranch}.${string}`; branch: SkillBranch }[];

export type SkillFocus = (typeof SKILL_FOCUSES)[number];
export type SkillFocusId = SkillFocus["id"];

/** Planning is an intention, so it stays small; reflecting afterwards may list everything touched. */
export const MAX_PLANNED_FOCUSES_PER_SESSION = 2;

const SKILL_FOCUS_ID_SET: ReadonlySet<string> = new Set(SKILL_FOCUSES.map((focus) => focus.id));

export function isSkillFocusId(value: unknown): value is SkillFocusId {
  return typeof value === "string" && SKILL_FOCUS_ID_SET.has(value);
}

export function isSkillBranch(value: unknown): value is SkillBranch {
  return typeof value === "string" && (SKILL_BRANCHES as readonly string[]).includes(value);
}

export function branchOfFocus(id: SkillFocusId): SkillBranch {
  return id.split(".")[0] as SkillBranch;
}

export function focusesForBranch(branch: SkillBranch): SkillFocus[] {
  return SKILL_FOCUSES.filter((focus) => focus.branch === branch);
}

/** Branches whose focuses a session of this type can pick from. */
export function skillBranchesForSessionType(type: SessionType): readonly SkillBranch[] {
  if (type === "mix_and_master") return ["mixing", "mastering"];
  if (type === "learning") return SKILL_BRANCHES;
  return [type];
}
