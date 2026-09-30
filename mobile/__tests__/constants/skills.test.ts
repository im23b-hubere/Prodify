import en from "../../locales/en.json";
import { SKILL_FOCUS_ICONS } from "../../constants/skillIcons";
import {
  SKILL_BRANCHES,
  SKILL_FOCUSES,
  focusesForBranch,
  skillBranchesForSessionType,
} from "../../constants/skills";
import { skillBranchKey, skillFocusKey, type SkillFocusTextField } from "../../lib/skillI18n";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const CHIP_LABEL_MAX_LENGTH = 15;
const FOCUS_TEXT_FIELDS: SkillFocusTextField[] = [
  "label",
  "short",
  "description",
  "practice",
  "covers",
];

function lookup(key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, en);
}

describe("skill catalog", () => {
  it("uses unique focus ids", () => {
    const ids = SKILL_FOCUSES.map((focus) => focus.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prefixes every focus id with its branch", () => {
    for (const focus of SKILL_FOCUSES) {
      expect(focus.id.startsWith(`${focus.branch}.`)).toBe(true);
    }
  });

  it("gives every branch between five and eight focuses", () => {
    for (const branch of SKILL_BRANCHES) {
      const count = focusesForBranch(branch).length;
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("has an icon for every focus", () => {
    const missing = SKILL_FOCUSES.filter((focus) => !SKILL_FOCUS_ICONS[focus.id]);
    expect(missing).toEqual([]);
  });

  it("lets mix & master sessions pick from mixing and mastering", () => {
    expect(skillBranchesForSessionType("mix_and_master")).toEqual(["mixing", "mastering"]);
  });

  it("lets learning sessions pick from every branch", () => {
    expect(skillBranchesForSessionType("learning")).toEqual(SKILL_BRANCHES);
  });

  it("maps a regular session type to its own branch", () => {
    expect(skillBranchesForSessionType("sound_design")).toEqual(["sound_design"]);
  });
});

describe("skill catalog copy", () => {
  it("has a description for every branch", () => {
    for (const branch of SKILL_BRANCHES) {
      expect(lookup(`${skillBranchKey(branch)}.description`)).toEqual(expect.any(String));
    }
  });

  it("has every text field for every focus", () => {
    const missingKeys = SKILL_FOCUSES.flatMap((focus) =>
      FOCUS_TEXT_FIELDS.map((field) => skillFocusKey(focus.id, field)),
    ).filter((key) => typeof lookup(key) !== "string");
    expect(missingKeys).toEqual([]);
  });

  it("keeps chip labels short enough for one line", () => {
    for (const focus of SKILL_FOCUSES) {
      const short = String(lookup(skillFocusKey(focus.id, "short")));
      expect(short.length).toBeLessThanOrEqual(CHIP_LABEL_MAX_LENGTH);
    }
  });

  it("has no copy for focuses missing from the catalog", () => {
    const catalogKeys = new Set(SKILL_FOCUSES.map((focus) => skillFocusKey(focus.id, "label")));
    for (const branch of SKILL_BRANCHES) {
      const focuses = lookup(`${skillBranchKey(branch)}.focuses`) as Record<string, unknown>;
      for (const focusKey of Object.keys(focuses)) {
        expect(catalogKeys).toContain(`${skillBranchKey(branch)}.focuses.${focusKey}.label`);
      }
    }
  });
});
