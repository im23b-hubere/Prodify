import {
  formatCompactDuration,
  leveledUpTo,
  skillProgressView,
} from "../../../features/sessions/skillProgressPresentation";
import { parseSkillProgressList } from "../../../lib/skillProgressDto";
import type { SkillProgressDto } from "../../../types/skillProgress";

const HOUR = 3600;

function progress(overrides: Partial<SkillProgressDto> = {}): SkillProgressDto {
  return {
    skill_id: "mixing.eq",
    gained_seconds: 30 * 60,
    total_seconds: 2 * HOUR,
    level: 2,
    previous_level: 2,
    level_start_seconds: HOUR,
    next_level_seconds: 3 * HOUR,
    ...overrides,
  };
}

describe("skillProgressView", () => {
  it("grows the bar from the fill before this session to the fill after it", () => {
    const view = skillProgressView(progress());

    expect(view.gainedMinutes).toBe(30);
    expect(view.fromFraction).toBeCloseTo(0.25);
    expect(view.toFraction).toBeCloseTo(0.5);
    expect(view.secondsToNextLevel).toBe(HOUR);
  });

  it("starts an empty bar after a level up", () => {
    const view = skillProgressView(progress({ previous_level: 1, total_seconds: 1.2 * HOUR }));

    expect(view.isLevelUp).toBe(true);
    expect(view.fromFraction).toBe(0);
  });

  it("shows a full bar and no next level at the top", () => {
    const view = skillProgressView(
      progress({ level: 7, previous_level: 7, level_start_seconds: 40 * HOUR, next_level_seconds: null }),
    );

    expect(view.toFraction).toBe(1);
    expect(view.secondsToNextLevel).toBeNull();
  });
});

describe("leveledUpTo", () => {
  it("returns the new level only when this session crossed it", () => {
    expect(leveledUpTo(progress({ previous_level: 1, level: 2 }))).toBe(2);
    expect(leveledUpTo(progress())).toBeNull();
    expect(leveledUpTo(undefined)).toBeNull();
  });
});

describe("formatCompactDuration", () => {
  it.each([
    [45 * 60, "45m"],
    [HOUR, "1h"],
    [80 * 60, "1h 20m"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatCompactDuration(seconds)).toBe(expected);
  });
});

describe("parseSkillProgressList", () => {
  it("drops rows for unknown skills or with broken numbers", () => {
    const parsed = parseSkillProgressList([
      progress(),
      { ...progress(), skill_id: "mixing.vibes" },
      { ...progress(), total_seconds: "lots" },
    ]);

    expect(parsed).toEqual([progress()]);
  });
});
