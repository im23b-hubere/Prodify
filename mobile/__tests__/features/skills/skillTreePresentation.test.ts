import {
  NEGLECTED_AFTER_DAYS,
  buildSkillTreeModel,
  neglectedFocus,
  strongestBranches,
} from "../../../features/skills/skillTreePresentation";
import type { SkillProfileDto } from "../../../types/skillProfile";

const HOUR = 3600;
const NOW = new Date("2026-09-30T12:00:00Z");

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * HOUR * 1000).toISOString();
}

function node(totalSeconds: number, lastTrainedAt: string | null = null) {
  return {
    total_seconds: totalSeconds,
    level: totalSeconds >= HOUR ? 2 : 1,
    level_start_seconds: totalSeconds >= HOUR ? HOUR : 0,
    next_level_seconds: totalSeconds >= HOUR ? 3 * HOUR : HOUR,
    session_count: totalSeconds > 0 ? 1 : 0,
    last_trained_at: lastTrainedAt,
  };
}

const profile: SkillProfileDto = {
  total_seconds: 10 * HOUR,
  branches: [
    { branch: "mixing", ...node(8 * HOUR, daysAgo(1)) },
    { branch: "beat_making", ...node(2 * HOUR, daysAgo(3)) },
    { branch: "mastering", ...node(0) },
  ],
  focuses: [
    { skill_id: "mixing.eq", branch: "mixing", ...node(2 * HOUR, daysAgo(1)) },
    { skill_id: "mixing.saturation", branch: "mixing", ...node(1800, daysAgo(30)) },
  ],
};

describe("buildSkillTreeModel", () => {
  it("locks everything while no profile is loaded", () => {
    const model = buildSkillTreeModel(null);

    expect(model.unlockedFocusCount).toBe(0);
    expect(model.branches.mixing.isUnlocked).toBe(false);
    expect(model.focusCount).toBeGreaterThan(40);
  });

  it("unlocks a node from its first counted minute", () => {
    const model = buildSkillTreeModel(profile);

    expect(model.focuses["mixing.saturation"].isUnlocked).toBe(true);
    expect(model.focuses["mixing.balance"].isUnlocked).toBe(false);
    expect(model.branches.mastering.isUnlocked).toBe(false);
    expect(model.unlockedFocusCount).toBe(2);
  });

  it("reports progress within the current level and time to the next one", () => {
    const eq = buildSkillTreeModel(profile).focuses["mixing.eq"];

    expect(eq.level).toBe(2);
    expect(eq.levelFraction).toBeCloseTo(0.5);
    expect(eq.secondsToNextLevel).toBe(HOUR);
  });
});

describe("strongestBranches", () => {
  it("lists unlocked branches with the most time first", () => {
    expect(strongestBranches(buildSkillTreeModel(profile), 3)).toEqual(["mixing", "beat_making"]);
  });
});

describe("neglectedFocus", () => {
  it("names the unlocked focus that has rested longest", () => {
    expect(neglectedFocus(buildSkillTreeModel(profile), NOW)).toEqual({
      id: "mixing.saturation",
      days: 30,
    });
  });

  it("stays quiet while every skill was trained recently", () => {
    const recent: SkillProfileDto = {
      ...profile,
      focuses: [
        {
          skill_id: "mixing.eq",
          branch: "mixing",
          ...node(HOUR, daysAgo(NEGLECTED_AFTER_DAYS - 1)),
        },
      ],
    };

    expect(neglectedFocus(buildSkillTreeModel(recent), NOW)).toBeNull();
  });
});
